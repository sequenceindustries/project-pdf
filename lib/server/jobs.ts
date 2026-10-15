import { createHash, randomBytes, randomUUID } from "node:crypto";
import { q } from "./db";

export const STATUSES = [
  "uploading",
  "queued",
  "processing",
  "validating",
  "completed",
  "failed",
  "cancelled",
] as const;
export type JobStatus = (typeof STATUSES)[number];

export const MAX_ATTEMPTS = 3;
export const STALE_SECONDS = 120;

export type PageText = { n: number; text: string };

export type JobRow = {
  id: string;
  token_hash: string;
  status: JobStatus;
  task: string;
  instruction: string;
  filename: string;
  page_count: number;
  input_pages: PageText[] | null;
  result: unknown;
  error_code: string | null;
  error_message: string | null;
  attempts: number;
  usage: { input_tokens: number; output_tokens: number } | null;
  created_at: string;
  updated_at: string;
  expires_at: string;
};

export function hashToken(t: string) {
  return createHash("sha256").update(t).digest("hex");
}

export function retentionHours() {
  const n = Number(process.env.PEEDF_RETENTION_HOURS);
  return Number.isFinite(n) && n > 0 ? n : 24;
}

export async function createJob(p: {
  task: string;
  instruction: string;
  filename: string;
  pages: PageText[];
}) {
  const id = randomUUID();
  const token = randomBytes(24).toString("base64url");
  await q(
    `INSERT INTO peedf.jobs (id, token_hash, status, task, instruction, filename, page_count, input_pages, expires_at)
     VALUES ($1,$2,'queued',$3,$4,$5,$6,$7, now() + ($8 || ' hours')::interval)`,
    [id, hashToken(token), p.task, p.instruction, p.filename, p.pages.length, JSON.stringify(p.pages), String(retentionHours())],
  );
  return { id, token };
}

/** Returns the job only if the token matches and it has not expired. */
export async function getJob(id: string, token: string): Promise<JobRow | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id) || !token) return null;
  const rows = await q<JobRow>(`SELECT * FROM peedf.jobs WHERE id=$1 AND token_hash=$2 AND expires_at > now()`, [
    id,
    hashToken(token),
  ]);
  return rows[0] ?? null;
}

export async function getJobInternal(id: string): Promise<JobRow | null> {
  return (await q<JobRow>(`SELECT * FROM peedf.jobs WHERE id=$1`, [id]))[0] ?? null;
}

/** Atomically claim one specific queued job. */
export async function claim(id: string): Promise<JobRow | null> {
  const rows = await q<JobRow>(
    `UPDATE peedf.jobs SET status='processing', attempts=attempts+1, updated_at=now()
     WHERE id=$1 AND status='queued' AND run_after <= now() RETURNING *`,
    [id],
  );
  return rows[0] ?? null;
}

export async function claimNextId(): Promise<string | null> {
  const rows = await q<{ id: string }>(
    `SELECT id FROM peedf.jobs WHERE status='queued' AND run_after <= now() AND expires_at > now()
     ORDER BY created_at LIMIT 1`,
  );
  return rows[0]?.id ?? null;
}

export async function setStatus(id: string, from: JobStatus[], to: JobStatus) {
  const rows = await q(`UPDATE peedf.jobs SET status=$2, updated_at=now() WHERE id=$1 AND status = ANY($3) RETURNING id`, [
    id,
    to,
    from,
  ]);
  return rows.length > 0;
}

export async function complete(id: string, result: unknown, usage: unknown) {
  const rows = await q(
    `UPDATE peedf.jobs SET status='completed', result=$2, usage=$3, input_pages=NULL, error_code=NULL, error_message=NULL, updated_at=now()
     WHERE id=$1 AND status='validating' RETURNING id`,
    [id, JSON.stringify(result), JSON.stringify(usage)],
  );
  return rows.length > 0;
}

export async function fail(id: string, code: string, message: string) {
  await q(
    `UPDATE peedf.jobs SET status='failed', error_code=$2, error_message=$3, input_pages=NULL, updated_at=now()
     WHERE id=$1 AND status IN ('queued','processing','validating')`,
    [id, code, message],
  );
}

/** Bounded retry: back to queued with a delay, or failed once attempts are exhausted. */
export async function retryOrFail(id: string, attempts: number, code: string, message: string) {
  if (attempts >= MAX_ATTEMPTS) return fail(id, code, message);
  const delay = 5 * 2 ** attempts;
  await q(
    `UPDATE peedf.jobs SET status='queued', error_code=$2, run_after = now() + ($3 || ' seconds')::interval, updated_at=now()
     WHERE id=$1 AND status IN ('processing','validating')`,
    [id, code, String(delay)],
  );
}

export async function cancel(id: string) {
  const rows = await q(
    `UPDATE peedf.jobs SET status='cancelled', input_pages=NULL, updated_at=now()
     WHERE id=$1 AND status IN ('queued','processing','validating') RETURNING id`,
    [id],
  );
  return rows.length > 0;
}

/** Recover jobs stranded by a worker restart; exhausted ones fail cleanly. */
export async function requeueStale() {
  await q(
    `UPDATE peedf.jobs SET status='failed', error_code='worker_lost',
       error_message='Processing was interrupted too many times. Please try again.', input_pages=NULL, updated_at=now()
     WHERE status IN ('processing','validating') AND updated_at < now() - ($1 || ' seconds')::interval AND attempts >= $2`,
    [String(STALE_SECONDS), MAX_ATTEMPTS],
  );
  await q(
    `UPDATE peedf.jobs SET status='queued', run_after=now(), updated_at=now()
     WHERE status IN ('processing','validating') AND updated_at < now() - ($1 || ' seconds')::interval AND attempts < $2`,
    [String(STALE_SECONDS), MAX_ATTEMPTS],
  );
}

export async function deleteExpired() {
  const rows = await q(`DELETE FROM peedf.jobs WHERE expires_at < now() RETURNING id`);
  return rows.length;
}
