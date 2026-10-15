import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";
import { config } from "./config";

/**
 * One pg pool per process. Railway's internal Postgres URL needs no TLS;
 * the public proxy URL does, so TLS is enabled when the URL asks for it.
 */

declare global {
  // eslint-disable-next-line no-var
  var __peedfPool: pg.Pool | undefined;
}

export function pool(): pg.Pool {
  if (!config.databaseUrl) throw new Error("DATABASE_URL is not set");
  if (!globalThis.__peedfPool) {
    const needsTls = /sslmode=require|proxy\.rlwy\.net/.test(config.databaseUrl);
    globalThis.__peedfPool = new pg.Pool({
      connectionString: config.databaseUrl,
      max: Number(process.env.PG_POOL_MAX ?? 5),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      ssl: needsTls ? { rejectUnauthorized: false } : undefined,
    });
    globalThis.__peedfPool.on("error", (err) => {
      console.error(JSON.stringify({ level: "error", msg: "pg_pool_error", error: err.message }));
    });
  }
  return globalThis.__peedfPool;
}

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<pg.QueryResult<T>> {
  return pool().query<T>(text, params);
}

export async function tx<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool().connect();
  try {
    await client.query("begin");
    const out = await fn(client);
    await client.query("commit");
    return out;
  } catch (e) {
    await client.query("rollback").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

/** Applies db/migrations/*.sql in order, once each, under an advisory lock. */
export async function migrate(dir = path.join(process.cwd(), "db", "migrations")) {
  const client = await pool().connect();
  try {
    await client.query("select pg_advisory_lock(727001)");
    await client.query(
      "create table if not exists schema_migrations (version text primary key, applied_at timestamptz not null default now())"
    );
    const applied = new Set(
      (await client.query<{ version: string }>("select version from schema_migrations")).rows.map((r) => r.version)
    );
    const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
    for (const f of files) {
      if (applied.has(f)) continue;
      const sql = await readFile(path.join(dir, f), "utf8");
      await client.query("begin");
      try {
        await client.query(sql);
        await client.query("insert into schema_migrations (version) values ($1)", [f]);
        await client.query("commit");
      } catch (e) {
        await client.query("rollback");
        throw e;
      }
    }
  } finally {
    await client.query("select pg_advisory_unlock(727001)").catch(() => {});
    client.release();
  }
}

export async function closePool() {
  if (globalThis.__peedfPool) {
    await globalThis.__peedfPool.end();
    globalThis.__peedfPool = undefined;
  }
}
