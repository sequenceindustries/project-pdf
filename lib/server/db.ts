import { Pool } from "pg";

export type Db = {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<{ rows: T[] }>;
};

export class NotConfiguredError extends Error {
  constructor(what: string) {
    super(`${what} is not configured`);
    this.name = "NotConfiguredError";
  }
}

let db: Db | null = null;
let schemaReady: Promise<void> | null = null;

/** Test hook: inject a database (e.g. in-memory PGlite). */
export function setDb(d: Db | null) {
  db = d;
  schemaReady = null;
}

export function dbConfigured(): boolean {
  return !!db || !!process.env.DATABASE_URL;
}

function getDb(): Db {
  if (db) return db;
  const url = process.env.DATABASE_URL;
  if (!url) throw new NotConfiguredError("DATABASE_URL");
  const pool = new Pool({ connectionString: url, max: 5, idleTimeoutMillis: 30_000 });
  pool.on("error", () => {});
  db = pool as unknown as Db;
  return db;
}

const SCHEMA = [
  `CREATE SCHEMA IF NOT EXISTS peedf`,
  `CREATE TABLE IF NOT EXISTS peedf.jobs (
    id uuid PRIMARY KEY,
    token_hash text NOT NULL,
    status text NOT NULL,
    task text NOT NULL,
    instruction text NOT NULL,
    filename text NOT NULL,
    page_count int NOT NULL,
    input_pages jsonb,
    result jsonb,
    error_code text,
    error_message text,
    attempts int NOT NULL DEFAULT 0,
    run_after timestamptz NOT NULL DEFAULT now(),
    usage jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS jobs_status_idx ON peedf.jobs (status, run_after)`,
];

export async function q<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  const d = getDb();
  if (!schemaReady) {
    schemaReady = (async () => {
      for (const s of SCHEMA) await d.query(s);
    })();
    schemaReady.catch(() => {
      schemaReady = null;
    });
  }
  await schemaReady;
  return (await d.query<T>(text, params)).rows;
}
