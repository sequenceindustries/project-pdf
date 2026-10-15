import { createHash, randomUUID } from "node:crypto";
import type pg from "pg";
import { query } from "./db";

/**
 * File storage. MVP implementation keeps bytes in Postgres (the util-peedf
 * project's own database), which gives transactional writes, no extra
 * service, and deletion in the same place as the job record.
 *
 * Keep this interface narrow so it can move to private object storage
 * (R2/S3 with short-lived signed URLs) without touching callers.
 */

type Queryable = Pick<pg.PoolClient, "query">;

export async function putBlob(data: Uint8Array, client?: Queryable): Promise<string> {
  const id = randomUUID();
  const sha256 = createHash("sha256").update(data).digest("hex");
  const q = client ? client.query.bind(client) : query;
  await q("insert into blobs (id, data, size, sha256) values ($1, $2, $3, $4)", [
    id,
    Buffer.from(data.buffer, data.byteOffset, data.byteLength),
    data.byteLength,
    sha256,
  ]);
  return id;
}

export async function getBlob(id: string): Promise<Buffer | null> {
  const r = await query<{ data: Buffer }>("select data from blobs where id = $1", [id]);
  return r.rows[0]?.data ?? null;
}

export async function deleteBlobs(ids: string[], client?: Queryable) {
  if (!ids.length) return;
  const q = client ? client.query.bind(client) : query;
  await q("delete from blobs where id = any($1::uuid[])", [ids]);
}
