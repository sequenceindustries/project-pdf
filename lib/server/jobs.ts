import { randomUUID } from "node:crypto";
import { config } from "./config";
import { query, tx } from "./db";
import { deleteBlobs, putBlob } from "./storage";

/**
 * Job lifecycle (persisted in Postgres, so a refresh or a worker restart
 * never loses state):
 *
 *   queued → processing → validating → completed
 *                 ↘ needs_input (clarification; user can send a new instruction)
 *                 ↘ failed (after bounded retries) / cancelled
 *
 * "Uploading" happens in the browser before the job exists.
 */

export type JobStatus = "queued" | "processing" | "validating" | "completed" | "failed" | "cancelled" | "needs_input";

export type JobRow = {
  id: string;
  owner_hash: string;
  ip_hash: string | null;
  instruction: string | null;
  status: JobStatus;
  plan: unknown;
  planner: string | null;
  progress: { step?: number; total?: number; message?: string };
  result: unknown;
  error_code: string | null;
  error_message: string | null;
  attempts: number;
  max_attempts: number;
  uses_ai: boolean;
  cancel_requested: boolean;
  created_at: Date;
  started_at: Date | null;
  finished_at: Date | null;
  expires_at: Date;
  purged_at: Date | null;
};

export type FileRow = {
  id: string;
  job_id: string;
  kind: "input" | "output";
  position: number;
  name: string;
  mime: string;
  size: number;
  pages: number | null;
  blob_id: string | null;
  meta: Record<string, unknown>;
};

export class LimitError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/* ---------------- creation (API) ---------------- */

/**
 * Limits count runs (a new job, or a new instruction on existing files),
 * recorded as usage_events kind 'job_run', so re-running can't bypass them.
 */
export async function checkCreateLimits(owner: string, ip: string | null) {
  const r = await query<{ active: string; today: string; ip_hour: string }>(
    `select
       (select count(*) from jobs where owner_hash = $1 and status in ('queued','processing','validating')) as active,
       (select count(*) from usage_events where owner_hash = $1 and kind = 'job_run' and created_at > now() - interval '1 day') as today,
       (select count(*) from usage_events where $2::text is not null and ip_hash = $2 and kind = 'job_run' and created_at > now() - interval '1 hour') as ip_hour`,
    [owner, ip]
  );
  const { active, today, ip_hour } = r.rows[0];
  const L = config.limits;
  if (Number(active) >= L.maxActiveJobsPerVisitor) throw new LimitError(429, "You already have jobs running. Wait for one to finish, then try again.");
  if (Number(today) >= L.jobsPerVisitorPerDay) throw new LimitError(429, "You've reached today's limit for workspace jobs. Please try again tomorrow.");
  if (Number(ip_hour) >= L.jobsPerIpPerHour) throw new LimitError(429, "Too many requests from this network. Please wait a while and try again.");
}

export async function createJob(input: {
  owner: string;
  ip: string | null;
  instruction: string;
  files: { name: string; mime: string; bytes: Uint8Array }[];
}): Promise<string> {
  const id = randomUUID();
  await tx(async (c) => {
    await c.query(
      `insert into jobs (id, owner_hash, ip_hash, instruction, status, expires_at)
       values ($1, $2, $3, $4, 'queued', now() + make_interval(hours => $5))`,
      [id, input.owner, input.ip, input.instruction, config.retention.contentHours]
    );
    for (let i = 0; i < input.files.length; i++) {
      const f = input.files[i];
      const blob = await putBlob(f.bytes, c);
      await c.query(
        `insert into job_files (id, job_id, kind, position, name, mime, size, blob_id) values ($1, $2, 'input', $3, $4, $5, $6, $7)`,
        [randomUUID(), id, i, f.name, f.mime, f.bytes.byteLength, blob]
      );
    }
    await c.query(`insert into usage_events (job_id, owner_hash, ip_hash, kind, quantity) values ($1, $2, $3, 'job_run', 1)`, [
      id,
      input.owner,
      input.ip,
    ]);
  });
  return id;
}

/* ---------------- reads (API) ---------------- */

export async function getOwnedJob(id: string, owner: string): Promise<JobRow | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const r = await query<JobRow>("select * from jobs where id = $1 and owner_hash = $2", [id, owner]);
  return r.rows[0] ?? null;
}

export async function getJobFiles(jobId: string): Promise<FileRow[]> {
  const r = await query<FileRow>(
    "select id, job_id, kind, position, name, mime, size, pages, blob_id, meta from job_files where job_id = $1 order by kind, position",
    [jobId]
  );
  return r.rows;
}

export async function getOwnedFile(fileId: string, owner: string) {
  if (!/^[0-9a-f-]{36}$/i.test(fileId)) return null;
  const r = await query<FileRow & { status: JobStatus; purged_at: Date | null; expires_at: Date }>(
    `select f.*, j.status, j.purged_at, j.expires_at from job_files f join jobs j on j.id = f.job_id
     where f.id = $1 and j.owner_hash = $2`,
    [fileId, owner]
  );
  return r.rows[0] ?? null;
}

export async function listOwnedJobs(owner: string, limit = 10) {
  const r = await query<Pick<JobRow, "id" | "status" | "created_at" | "purged_at"> & { instruction: string | null; files: number }>(
    `select j.id, j.status, j.created_at, j.purged_at, j.instruction,
            (select count(*)::int from job_files f where f.job_id = j.id and f.kind = 'input') as files
     from jobs j where owner_hash = $1 order by created_at desc limit $2`,
    [owner, limit]
  );
  return r.rows;
}

export async function requestCancel(id: string, owner: string) {
  const r = await query<{ status: JobStatus }>(
    `update jobs set
       cancel_requested = true,
       status = case when status in ('queued','needs_input') then 'cancelled' else status end,
       finished_at = case when status in ('queued','needs_input') then now() else finished_at end
     where id = $1 and owner_hash = $2 and status in ('queued','processing','validating','needs_input')
     returning status`,
    [id, owner]
  );
  return r.rows[0]?.status ?? null;
}

/** Re-queues a job that stopped for clarification, with a new instruction on the same files. */
export async function reviseInstruction(id: string, owner: string, ip: string | null, instruction: string) {
  return tx(async (c) => {
    const r = await c.query(
      `update jobs set instruction = $3, ip_hash = coalesce($4, ip_hash), status = 'queued', plan = null, planner = null, progress = '{}'::jsonb, result = null,
         error_code = null, error_message = null, attempts = 0, lease_until = null, worker_id = null, finished_at = null, cancel_requested = false
       where id = $1 and owner_hash = $2 and status in ('needs_input','failed','completed','cancelled') and purged_at is null
       returning id`,
      [id, owner, instruction, ip]
    );
    if (r.rowCount !== 1) return false;
    await c.query(`insert into usage_events (job_id, owner_hash, ip_hash, kind, quantity) values ($1, $2, $3, 'job_run', 1)`, [id, owner, ip]);
    // Previous results are replaced, not accumulated.
    const old = await c.query<{ blob_id: string | null }>(`delete from job_files where job_id = $1 and kind = 'output' returning blob_id`, [id]);
    await deleteBlobs(old.rows.map((x) => x.blob_id).filter((x): x is string => Boolean(x)), c);
    return true;
  });
}

/* ---------------- worker side ---------------- */

export async function claimJob(workerId: string): Promise<JobRow | null> {
  const r = await query<JobRow>(
    `update jobs set status = 'processing', attempts = attempts + 1, worker_id = $1,
       lease_until = now() + make_interval(secs => $2), started_at = coalesce(started_at, now())
     where id = (
       select id from jobs
       where cancel_requested = false and attempts < max_attempts and (
         (status = 'queued' and (lease_until is null or lease_until < now()))
         or (status in ('processing','validating') and lease_until < now())
       )
       order by created_at
       for update skip locked
       limit 1
     )
     returning *`,
    [workerId, config.worker.leaseSeconds]
  );
  return r.rows[0] ?? null;
}

export async function heartbeat(id: string, workerId: string) {
  const r = await query<{ cancel_requested: boolean }>(
    `update jobs set lease_until = now() + make_interval(secs => $3) where id = $1 and worker_id = $2 returning cancel_requested`,
    [id, workerId, config.worker.leaseSeconds]
  );
  return { owned: r.rowCount === 1, cancelRequested: r.rows[0]?.cancel_requested ?? false };
}

export async function setProgress(id: string, workerId: string, status: "processing" | "validating", progress: JobRow["progress"]) {
  await query(`update jobs set status = $3, progress = $4 where id = $1 and worker_id = $2 and status in ('processing','validating')`, [
    id,
    workerId,
    status,
    JSON.stringify(progress),
  ]);
}

export async function savePlan(id: string, workerId: string, plan: unknown, planner: string, usesAi: boolean) {
  await query(`update jobs set plan = $3, planner = $4, uses_ai = $5 where id = $1 and worker_id = $2`, [
    id,
    workerId,
    JSON.stringify(plan),
    planner,
    usesAi,
  ]);
}

export async function setInputMeta(fileId: string, jobId: string, workerId: string, pages: number, meta: Record<string, unknown>) {
  await query(
    `update job_files f set pages = $4, meta = $5 from jobs j
     where f.id = $1 and f.job_id = $2 and j.id = f.job_id and j.worker_id = $3`,
    [fileId, jobId, workerId, pages, JSON.stringify(meta)]
  );
}

/** AI runs in the last 24h, per visitor and per network (every run counts, including re-runs). */
export async function aiRunsToday(owner: string, ip: string | null) {
  const r = await query<{ owner_n: string; ip_n: string }>(
    `select
       (select count(*) from usage_events where owner_hash = $1 and kind = 'ai_run' and created_at > now() - interval '1 day') as owner_n,
       (select count(*) from usage_events where $2::text is not null and ip_hash = $2 and kind = 'ai_run' and created_at > now() - interval '1 day') as ip_n`,
    [owner, ip]
  );
  return { owner: Number(r.rows[0].owner_n), ip: Number(r.rows[0].ip_n) };
}

/** Records an AI run before any model call for analysis, so failed/cancelled runs still count. */
export async function recordAiRun(jobId: string, owner: string, ip: string | null, pages: number) {
  await query(`insert into usage_events (job_id, owner_hash, ip_hash, kind, quantity) values ($1, $2, $3, 'ai_run', $4)`, [jobId, owner, ip, pages]);
}

export async function finishJob(
  id: string,
  workerId: string,
  outcome:
    | { status: "completed"; result: unknown; outputs: { name: string; mime: string; bytes: Uint8Array; pages?: number; meta?: Record<string, unknown> }[] }
    | { status: "needs_input" | "failed" | "cancelled"; code: string; message: string; result?: unknown }
): Promise<boolean> {
  return tx(async (c) => {
    const own = await c.query(
      `select 1 from jobs where id = $1 and worker_id = $2 and status in ('processing','validating') and purged_at is null for update`,
      [id, workerId]
    );
    if (!own.rowCount) return false; // lease lost, cancelled by the sweeper, or purged
    if (outcome.status === "completed") {
      for (let i = 0; i < outcome.outputs.length; i++) {
        const o = outcome.outputs[i];
        const blob = await putBlob(o.bytes, c);
        await c.query(
          `insert into job_files (id, job_id, kind, position, name, mime, size, pages, blob_id, meta) values ($1,$2,'output',$3,$4,$5,$6,$7,$8,$9)`,
          [randomUUID(), id, i, o.name, o.mime, o.bytes.byteLength, o.pages ?? null, blob, JSON.stringify(o.meta ?? {})]
        );
      }
      await c.query(
        `update jobs set status = 'completed', result = $2, finished_at = now(), lease_until = null,
           progress = jsonb_build_object('message', 'Done')
         where id = $1`,
        [id, JSON.stringify(outcome.result)]
      );
    } else {
      await c.query(
        `update jobs set status = $2, error_code = $3, error_message = $4, result = $5, finished_at = now(), lease_until = null where id = $1`,
        [id, outcome.status, outcome.code, outcome.message, outcome.result === undefined ? null : JSON.stringify(outcome.result)]
      );
    }
    return true;
  });
}

/** Releases a job for another attempt after a transient failure, with backoff. */
export async function retryLater(id: string, workerId: string, code: string, message: string, delaySeconds: number) {
  await query(
    `update jobs set
       status = case when cancel_requested then 'cancelled' else 'queued' end,
       finished_at = case when cancel_requested then now() else finished_at end,
       lease_until = case when cancel_requested then null else now() + make_interval(secs => $5) end,
       worker_id = null, error_code = $3, error_message = $4,
       progress = jsonb_build_object('message', case when cancel_requested then 'Cancelled.' else 'Waiting to retry…' end)
     where id = $1 and worker_id = $2`,
    [id, workerId, code, message, delaySeconds]
  );
}

/** On shutdown, hand jobs straight back to the queue instead of waiting for the lease to expire. */
export async function releaseJob(id: string, workerId: string) {
  await query(
    `update jobs set status = 'queued', lease_until = null, worker_id = null, attempts = greatest(attempts - 1, 0)
     where id = $1 and worker_id = $2 and status in ('processing','validating')`,
    [id, workerId]
  );
}

export async function recordUsage(
  jobId: string,
  owner: string,
  rows: { kind: string; tool?: string; quantity?: number; model?: string; inputTokens?: number; outputTokens?: number }[]
) {
  for (const u of rows) {
    await query(
      `insert into usage_events (job_id, owner_hash, kind, tool, quantity, model, input_tokens, output_tokens) values ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [jobId, owner, u.kind, u.tool ?? null, u.quantity ?? 0, u.model ?? null, u.inputTokens ?? null, u.outputTokens ?? null]
    );
  }
}

/* ---------------- retention ---------------- */

export async function sweep() {
  // 1a. Cancel requested and nobody is (any longer) working on it.
  const cancelled = await query(
    `update jobs set status = 'cancelled', finished_at = now(), lease_until = null, worker_id = null
     where cancel_requested and status in ('queued','processing','validating') and (lease_until is null or lease_until < now())
     returning id`
  );
  // 1b. Jobs whose retries are exhausted while leased by a dead worker.
  const stuck = await query(
    `update jobs set status = 'failed', error_code = 'worker_lost', error_message = 'Processing was interrupted too many times. Please try again.',
       finished_at = now(), lease_until = null, worker_id = null
     where status in ('processing','validating','queued') and attempts >= max_attempts and (lease_until is null or lease_until < now())
     returning id`
  );
  // 2. Purge content of expired jobs: file bytes, file names, instruction, results.
  const purged = await tx(async (c) => {
    const ids = (
      await c.query<{ id: string }>(
        `select id from jobs where expires_at < now() and purged_at is null and status not in ('queued','processing','validating') limit 200 for update skip locked`
      )
    ).rows.map((r) => r.id);
    if (!ids.length) return 0;
    const blobs = (
      await c.query<{ blob_id: string }>(`select blob_id from job_files where job_id = any($1::uuid[]) and blob_id is not null`, [ids])
    ).rows.map((r) => r.blob_id);
    await c.query(`update job_files set blob_id = null, name = 'deleted' where job_id = any($1::uuid[])`, [ids]);
    await deleteBlobs(blobs, c);
    await c.query(
      `update jobs set instruction = null, result = null, plan = null, error_message = null, progress = '{}'::jsonb, purged_at = now()
       where id = any($1::uuid[])`,
      [ids]
    );
    return ids.length;
  });
  // 3. Drop content-free metadata after the reporting window.
  const old = await query(`delete from jobs where created_at < now() - make_interval(days => $1) returning id`, [config.retention.metadataDays]);
  await query(`delete from usage_events where created_at < now() - make_interval(days => $1)`, [config.retention.metadataDays]);
  // 4. Orphaned blobs (e.g. from an aborted transaction elsewhere).
  const orphans = await query(
    `delete from blobs b where created_at < now() - interval '1 hour' and not exists (select 1 from job_files f where f.blob_id = b.id) returning id`
  );
  return { cancelled: cancelled.rowCount ?? 0, stuck: stuck.rowCount ?? 0, purged, deletedJobs: old.rowCount ?? 0, orphanBlobs: orphans.rowCount ?? 0 };
}

export async function queueStats() {
  const r = await query<{ queued: string; running: string; oldest_queued_s: string | null }>(
    `select count(*) filter (where status = 'queued') as queued,
            count(*) filter (where status in ('processing','validating')) as running,
            extract(epoch from now() - min(created_at) filter (where status = 'queued'))::int as oldest_queued_s
     from jobs where status in ('queued','processing','validating')`
  );
  return {
    queued: Number(r.rows[0].queued),
    running: Number(r.rows[0].running),
    oldestQueuedSeconds: r.rows[0].oldest_queued_s === null ? null : Number(r.rows[0].oldest_queued_s),
  };
}
