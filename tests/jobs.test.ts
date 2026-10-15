import { beforeEach, describe, expect, it, vi } from "vitest";
import * as jobs from "@/lib/server/jobs";
import { processJob } from "@/lib/server/engine";
import { setAiProvider } from "@/lib/server/ai";
import { q } from "@/lib/server/db";
import { freshDb } from "./helpers";

const pages = [{ n: 1, text: "Payment is due within 30 days of invoice date." }];
const good = {
  headline: "Invoice terms",
  summary: "Payment is due thirty days after the invoice.",
  points: [{ text: "30-day terms", pages: [1], quote: "due within 30 days" }],
  uncertainties: [],
  sensitive: true,
};
const make = () => jobs.createJob({ task: "summarise", instruction: "summarise", filename: "a.pdf", pages });

beforeEach(async () => {
  await freshDb();
  setAiProvider(null);
  vi.restoreAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("job store", () => {
  it("requires the right token", async () => {
    const { id, token } = await make();
    expect(await jobs.getJob(id, token)).not.toBeNull();
    expect(await jobs.getJob(id, "wrong")).toBeNull();
    expect(await jobs.getJob("not-a-uuid", token)).toBeNull();
  });
  it("hides expired jobs and deletes them", async () => {
    const { id, token } = await make();
    await q(`UPDATE peedf.jobs SET expires_at = now() - interval '1 minute'`);
    expect(await jobs.getJob(id, token)).toBeNull();
    expect(await jobs.deleteExpired()).toBe(1);
  });
  it("cancels queued jobs and drops their text", async () => {
    const { id } = await make();
    expect(await jobs.cancel(id)).toBe(true);
    const j = await jobs.getJobInternal(id);
    expect(j?.status).toBe("cancelled");
    expect(j?.input_pages).toBeNull();
  });
  it("recovers stale processing jobs, then fails after max attempts", async () => {
    const { id } = await make();
    await jobs.claim(id);
    await q(`UPDATE peedf.jobs SET updated_at = now() - interval '10 minutes'`);
    await jobs.requeueStale();
    expect((await jobs.getJobInternal(id))?.status).toBe("queued");
    await q(`UPDATE peedf.jobs SET status='processing', attempts=3, updated_at = now() - interval '10 minutes'`);
    await jobs.requeueStale();
    const j = await jobs.getJobInternal(id);
    expect(j?.status).toBe("failed");
    expect(j?.error_code).toBe("worker_lost");
  });
});

describe("engine", () => {
  it("completes a job and clears the stored text", async () => {
    setAiProvider({ run: async () => ({ output: good, usage: { input_tokens: 10, output_tokens: 5 } }) });
    const { id } = await make();
    await processJob(id);
    const j = await jobs.getJobInternal(id);
    expect(j?.status).toBe("completed");
    expect(j?.input_pages).toBeNull();
    expect((j?.result as { points: { verified: boolean }[] }).points[0].verified).toBe(true);
    expect(j?.usage).toEqual({ input_tokens: 10, output_tokens: 5 });
  });
  it("retries AI errors with backoff, then fails safely", async () => {
    setAiProvider({ run: async () => { throw new Error("boom: secret document text"); } });
    const { id } = await make();
    await processJob(id);
    let j = await jobs.getJobInternal(id);
    expect(j?.status).toBe("queued");
    expect(j?.attempts).toBe(1);
    await q(`UPDATE peedf.jobs SET run_after = now(), attempts = 2`);
    await processJob(id);
    j = await jobs.getJobInternal(id);
    expect(j?.status).toBe("failed");
    expect(j?.error_message).not.toContain("secret");
    expect(j?.input_pages).toBeNull();
  });
  it("rejects output that fails validation", async () => {
    setAiProvider({ run: async () => ({ output: { ...good, points: [{ text: "bad ref", pages: [5], quote: "xxxxxxxxxx" }] }, usage: { input_tokens: 1, output_tokens: 1 } }) });
    const { id } = await make();
    await processJob(id);
    expect((await jobs.getJobInternal(id))?.status).toBe("queued");
  });
  it("does not resurrect a cancelled job", async () => {
    let release!: () => void;
    setAiProvider({ run: () => new Promise((r) => { release = () => r({ output: good, usage: { input_tokens: 1, output_tokens: 1 } }); }) });
    const { id } = await make();
    const p = processJob(id);
    await new Promise((r) => setTimeout(r, 100));
    await jobs.cancel(id);
    release();
    await p;
    expect((await jobs.getJobInternal(id))?.status).toBe("cancelled");
  });
});
