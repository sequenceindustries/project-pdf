import { getProvider } from "./ai";
import { validateResult } from "./validate";
import * as jobs from "./jobs";

let running = 0;
const MAX_CONCURRENT = 2;

/** Runs one job through processing → validating → completed. Never throws. */
export async function processJob(id: string): Promise<void> {
  const job = await jobs.claim(id);
  if (!job || !job.input_pages) return;
  let output;
  try {
    output = await getProvider().run({
      instruction: job.instruction,
      task: job.task,
      filename: job.filename,
      pages: job.input_pages,
    });
  } catch (e) {
    // Log class only — never document content.
    console.error(`[job ${id}] ai_error`, e instanceof Error ? e.name : "unknown");
    await jobs.retryOrFail(id, job.attempts, "ai_error", "The AI service had a problem. Please try again.");
    return;
  }
  if (!(await jobs.setStatus(id, ["processing"], "validating"))) return; // cancelled meanwhile
  try {
    const result = validateResult(output.output, job.input_pages, job.filename);
    await jobs.complete(id, result, output.usage);
  } catch {
    console.error(`[job ${id}] validation_failed`);
    await jobs.retryOrFail(id, job.attempts, "validation_failed", "The result didn't pass our checks. Please try again.");
  }
}

/** Process queued jobs with bounded concurrency. Safe to call repeatedly. */
export async function drain(): Promise<void> {
  while (running < MAX_CONCURRENT) {
    const id = await jobs.claimNextId();
    if (!id) return;
    running++;
    processJob(id)
      .catch(() => {})
      .finally(() => {
        running--;
        void drain();
      });
  }
}

export async function sweep() {
  await jobs.requeueStale();
  await jobs.deleteExpired();
  await drain();
}
