import { hostname } from "node:os";
import { randomBytes } from "node:crypto";
import { config } from "../lib/server/config";
import { closePool, migrate } from "../lib/server/db";
import { emit, log } from "../lib/server/events";
import { claimJob, heartbeat, releaseJob, sweep } from "../lib/server/jobs";
import { processJob } from "./process-job";

/**
 * Background worker. Polls Postgres for queued jobs (FOR UPDATE SKIP LOCKED),
 * holds a renewable lease while processing, and re-queues work on shutdown.
 * If the process dies, the lease expires and another worker picks the job
 * up (bounded by max_attempts). Also runs the retention sweeper.
 */

const workerId = `${hostname()}-${process.pid}-${randomBytes(3).toString("hex")}`;
const running = new Map<string, Promise<void>>();
let stopping = false;

async function runOne(): Promise<boolean> {
  const job = await claimJob(workerId);
  if (!job) return false;
  // Stop work when the user cancels OR when we lose the lease (another worker
  // or the sweeper now owns the job; our final write would be rejected anyway).
  let stopFlag = false;
  const beat = setInterval(async () => {
    try {
      const hb = await heartbeat(job.id, workerId);
      if (hb.cancelRequested || !hb.owned) stopFlag = true;
    } catch {
      /* next beat will retry */
    }
  }, (config.worker.leaseSeconds * 1000) / 3);
  const p = processJob(job, workerId, async () => stopFlag)
    .catch((e) => log("error", "job_crash", { job: job.id, error: e instanceof Error ? e.name : "unknown" }))
    .finally(() => {
      clearInterval(beat);
      running.delete(job.id);
    });
  running.set(job.id, p);
  return true;
}

async function loop() {
  while (!stopping) {
    try {
      while (!stopping && running.size < config.worker.concurrency && (await runOne())) {
        /* fill free slots */
      }
    } catch (e) {
      log("error", "worker_loop_error", { error: e instanceof Error ? e.name : "unknown" });
    }
    await new Promise((r) => setTimeout(r, config.worker.pollMs));
  }
}

async function sweeper() {
  while (!stopping) {
    try {
      const s = await sweep();
      if (s.purged || s.stuck || s.deletedJobs || s.orphanBlobs) emit("sweep", s);
    } catch (e) {
      log("error", "sweep_error", { error: e instanceof Error ? e.name : "unknown" });
    }
    for (let i = 0; i < 300 && !stopping; i++) await new Promise((r) => setTimeout(r, 1000));
  }
}

async function shutdown(signal: string) {
  if (stopping) return;
  stopping = true;
  log("info", "worker_stopping", { signal, running: running.size });
  // Give in-flight jobs a moment, then hand the rest back to the queue.
  await Promise.race([Promise.allSettled(running.values()), new Promise((r) => setTimeout(r, 8000))]);
  for (const id of running.keys()) await releaseJob(id, workerId).catch(() => {});
  emit("worker_stopped", { worker: workerId });
  await closePool().catch(() => {});
  process.exit(0);
}

async function main() {
  if (!config.databaseUrl) {
    log("warn", "worker_disabled", { reason: "DATABASE_URL not set" });
    // Stay alive so the supervisor doesn't restart-loop; nothing to do.
    setInterval(() => {}, 1 << 30);
    return;
  }
  await migrate();
  emit("worker_started", { worker: workerId, concurrency: config.worker.concurrency, ai: Boolean(config.ai.apiKey) });
  // A stray rejection must never take down every in-flight job.
  process.on("unhandledRejection", (e) => log("error", "unhandled_rejection", { error: e instanceof Error ? e.name : "unknown" }));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
  await Promise.all([loop(), sweeper()]);
}

main().catch((e) => {
  log("error", "worker_fatal", { error: e instanceof Error ? e.name : "unknown" });
  process.exit(1);
});
