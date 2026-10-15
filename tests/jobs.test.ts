/**
 * Integration tests: real Postgres, real sandbox, real PDF operations.
 * Run with DATABASE_URL pointing at a disposable database (tables are truncated):
 *   DATABASE_URL=postgres://… npm run test:integration
 * The AI provider here is a scripted TEST DOUBLE — it checks our plumbing,
 * validation and source verification, not model quality.
 */
import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { PDFDocument as EncDoc } from "@cantoo/pdf-lib";
import { PDFDocument } from "pdf-lib";
import { closePool, migrate, query } from "../lib/server/db";
import {
  checkCreateLimits,
  claimJob,
  finishJob,
  createJob,
  getJobFiles,
  getOwnedJob,
  requestCancel,
  reviseInstruction,
  sweep,
} from "../lib/server/jobs";
import { getBlob } from "../lib/server/storage";
import { verify } from "../lib/engine/analyze";
import { LlmError, type LlmProvider, type StructuredCall } from "../lib/engine/llm";
import { processJob, setProvider } from "../worker/process-job";
import { makePdf } from "./helpers";

const OWNER = "a".repeat(64);
const OTHER = "b".repeat(64);
const W = "test-worker";
const never = async () => false;

class ScriptedProvider implements LlmProvider {
  calls: StructuredCall<unknown>[] = [];
  constructor(private script: (req: StructuredCall<unknown>) => unknown) {}
  async call<T>(req: StructuredCall<T>) {
    this.calls.push(req as StructuredCall<unknown>);
    const out = this.script(req as StructuredCall<unknown>);
    if (out instanceof Error) throw out;
    return { data: req.schema.parse(out), usage: { model: "test-double", inputTokens: 1000, outputTokens: 200 } };
  }
}

async function run(id: string) {
  const job = await claimJob(W);
  assert.ok(job, "job claimed");
  assert.equal(job!.id, id);
  await processJob(job!, W, never);
  return (await getOwnedJob(id, OWNER))!;
}

async function pdfFile(pages: number, name = "doc.pdf") {
  const p = await makePdf(pages, name);
  return { name, mime: "application/pdf", bytes: p.bytes };
}

before(async () => {
  assert.ok(process.env.DATABASE_URL, "set DATABASE_URL to a disposable test database");
  assert.match(process.env.DATABASE_URL!, /test/, "refusing to truncate a database whose name doesn't contain \"test\"");
  await migrate();
});
beforeEach(async () => {
  await query("truncate jobs, job_files, blobs, usage_events cascade");
  setProvider(null);
});
after(async () => {
  await closePool();
});

test("remove pages 5–8 and compress: completes with a validated 6-page PDF", async () => {
  const id = await createJob({ owner: OWNER, ip: null, instruction: "Remove pages 5–8 and compress the remaining document.", files: [await pdfFile(10)] });
  const job = await run(id);
  assert.equal(job.status, "completed", job.error_message ?? "");
  assert.equal(job.planner, "rules");
  const outs = (await getJobFiles(id)).filter((f) => f.kind === "output");
  assert.equal(outs.length, 1);
  const bytes = await getBlob(outs[0].blob_id!);
  assert.equal((await PDFDocument.load(bytes!)).getPageCount(), 6);
  const usage = await query("select kind from usage_events where job_id = $1", [id]);
  assert.ok(usage.rows.some((r) => r.kind === "pages_processed"));
});

test("merge two files then rotate", async () => {
  const id = await createJob({
    owner: OWNER,
    ip: null,
    instruction: "merge these and rotate page 2 right",
    files: [await pdfFile(2, "a.pdf"), await pdfFile(3, "b.pdf")],
  });
  const job = await run(id);
  assert.equal(job.status, "completed", job.error_message ?? "");
  const out = (await getJobFiles(id)).find((f) => f.kind === "output")!;
  const doc = await PDFDocument.load((await getBlob(out.blob_id!))!);
  assert.equal(doc.getPageCount(), 5);
  assert.deepEqual(doc.getPages().map((p) => p.getRotation().angle), [0, 90, 0, 0, 0]);
});

test("impossible page range asks for new input; revising the instruction re-runs on the same files", async () => {
  const id = await createJob({ owner: OWNER, ip: null, instruction: "remove pages 12-14", files: [await pdfFile(4)] });
  let job = await run(id);
  assert.equal(job.status, "needs_input");
  assert.match(job.error_message!, /4 pages/);
  assert.ok(await reviseInstruction(id, OWNER, null, "remove page 4"));
  assert.equal(await reviseInstruction(id, OTHER, null, "remove page 4"), false, "other visitors can't touch it");
  job = await run(id);
  assert.equal(job.status, "completed");
  // Revising a completed job replaces its outputs instead of accumulating them.
  assert.ok(await reviseInstruction(id, OWNER, null, "remove page 1"));
  job = await run(id);
  assert.equal(job.status, "completed");
  const outs = (await getJobFiles(id)).filter((f) => f.kind === "output");
  assert.equal(outs.length, 1);
  assert.equal((await PDFDocument.load((await getBlob(outs[0].blob_id!))!)).getPageCount(), 3);
  assert.equal((await query("select count(*)::int as n from blobs")).rows[0].n, 2, "1 input + 1 output; old output blob deleted");
});

test("AI request without an AI provider gives a clear, honest message", async () => {
  const id = await createJob({ owner: OWNER, ip: null, instruction: "Summarise this document", files: [await pdfFile(2)] });
  const job = await run(id);
  assert.equal(job.status, "needs_input");
  assert.equal(job.error_code, "ai_not_configured");
});

test("encrypted PDF is detected and explained", async () => {
  const d = await EncDoc.create();
  d.addPage();
  await d.encrypt({ userPassword: "pw12", ownerPassword: "pw12" });
  const id = await createJob({ owner: OWNER, ip: null, instruction: "compress", files: [{ name: "locked.pdf", mime: "application/pdf", bytes: await d.save() }] });
  const job = await run(id);
  assert.equal(job.status, "needs_input");
  assert.match(job.error_message!, /password/);
});

test("AI summary: plan → analysis → quotes verified against source → report PDF", async () => {
  const provider = new ScriptedProvider((req) => {
    if (req.toolName === "submit_plan") {
      assert.doesNotMatch(req.user, /INV-1001/, "planner must never see document text");
      return { decision: "plan", plan: { steps: [{ tool: "analyze", inputs: ["file:1"], mode: "summary" }] } };
    }
    assert.match(req.user, /<document n="1"/);
    assert.match(req.user, /<page n="2">/);
    return {
      title: "Invoice summary",
      answer_markdown: "Three invoices are listed (p. 1-3).",
      key_points: [{ text: "Invoices INV-1001 to INV-1003", doc: 1, pages: [1, 2, 3, 99] }],
      facts: [
        { category: "amount", label: "Total on page 2", value: "R 2500.00", doc: 1, page: 2, quote: "Total due: R 2500.00" },
        // Wrong page cited: should be corrected to page 3 and still verify.
        { category: "identifier", label: "Invoice", value: "INV-1003", doc: 1, page: 1, quote: "Invoice INV-1003 dated 2026-03-03" },
        // Fabricated: must be flagged unverified.
        { category: "amount", label: "Discount", value: "R 999", doc: 1, page: 1, quote: "Discount of R 999 applied" },
      ],
      records: [],
      not_found: [],
      caveats: [],
      injection_detected: false,
    };
  });
  setProvider(provider);
  const id = await createJob({ owner: OWNER, ip: null, instruction: "Summarise this and give me the key amounts", files: [await pdfFile(3)] });
  const job = await run(id);
  assert.equal(job.status, "completed", job.error_message ?? "");
  assert.equal(job.planner, "ai");
  const result = job.result as { analyses: { facts: { verified: boolean; page: number }[]; key_points: { pages: number[] }[]; caveats: string[] }[] };
  const facts = result.analyses[0].facts;
  assert.deepEqual(facts.map((f) => f.verified), [true, true, false]);
  assert.equal(facts[1].page, 3, "page corrected to where the quote actually is");
  assert.deepEqual(result.analyses[0].key_points[0].pages, [1, 2, 3], "out-of-range page refs dropped");
  assert.ok(result.analyses[0].caveats.some((c) => /1 of 3 quoted items/.test(c)));
  const out = (await getJobFiles(id)).filter((f) => f.kind === "output");
  assert.deepEqual(out.map((f) => f.name), ["summary.pdf"]);
  const tokens = await query("select sum(input_tokens)::int as i from usage_events where job_id = $1 and kind = 'ai_tokens'", [id]);
  assert.equal(tokens.rows[0].i, 2000, "planner + analysis tokens recorded");
});

test("AI extraction to Excel produces a real .xlsx with verification column", async () => {
  setProvider(
    new ScriptedProvider((req) =>
      req.toolName === "submit_plan"
        ? { decision: "plan", plan: { steps: [{ tool: "analyze", inputs: ["file:1"], mode: "extract", fields: ["Invoice number", "Total"], output: "xlsx" }] } }
        : {
            title: "Invoices",
            answer_markdown: "Two invoices.",
            key_points: [],
            facts: [],
            records: [
              { doc: 1, page: 1, quote: "Invoice INV-1001", fields: [{ name: "Invoice number", value: "INV-1001" }, { name: "Total", value: "R 1250.00" }] },
              { doc: 1, page: 2, quote: "Invoice INV-1002", fields: [{ name: "Invoice number", value: "INV-1002" }, { name: "Total", value: "=HYPERLINK(\"x\")" }] },
            ],
            not_found: [],
            caveats: [],
            injection_detected: false,
          }
    )
  );
  const id = await createJob({ owner: OWNER, ip: null, instruction: "Extract invoice numbers and totals into Excel", files: [await pdfFile(2)] });
  const job = await run(id);
  assert.equal(job.status, "completed", job.error_message ?? "");
  const out = (await getJobFiles(id)).filter((f) => f.kind === "output");
  assert.deepEqual(out.map((f) => f.name), ["extracted.xlsx"]);
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync((await getBlob(out[0].blob_id!))!);
  const sheet = await zip.file("xl/worksheets/sheet1.xml")!.async("string");
  assert.match(sheet, /INV-1001/);
  assert.match(sheet, /Verified against source/);
  assert.doesNotMatch(sheet, /<f>/, "no formulas are ever written");
});

test("transient AI failure is retried with backoff, then can complete", async () => {
  let fail = true;
  setProvider(
    new ScriptedProvider((req) => {
      if (fail) return new LlmError("ai_rate_limited", "busy", true);
      return req.toolName === "submit_plan"
        ? { decision: "clarify", question: "Which pages should I summarise?" }
        : {};
    })
  );
  const id = await createJob({ owner: OWNER, ip: null, instruction: "Summarise the important bits", files: [await pdfFile(2)] });
  let job = await run(id);
  assert.equal(job.status, "queued");
  assert.equal(job.attempts, 1);
  assert.equal(await claimJob(W), null, "backoff respected");
  await query("update jobs set lease_until = now() - interval '1 second' where id = $1", [id]);
  fail = false;
  job = await run(id);
  assert.equal(job.status, "needs_input");
  assert.equal(job.error_message, "Which pages should I summarise?");
});

test("a crashed worker's job is recovered by another worker after the lease expires", async () => {
  const id = await createJob({ owner: OWNER, ip: null, instruction: "compress", files: [await pdfFile(2)] });
  const first = await claimJob("dead-worker");
  assert.equal(first!.id, id);
  assert.equal(await claimJob(W), null, "still leased");
  await query("update jobs set lease_until = now() - interval '1 second' where id = $1", [id]);
  const job = await run(id);
  assert.equal(job.status, "completed");
  assert.equal(job.attempts, 2);
});

test("cancel and ownership", async () => {
  const id = await createJob({ owner: OWNER, ip: null, instruction: "compress", files: [await pdfFile(1)] });
  assert.equal(await getOwnedJob(id, OTHER), null);
  assert.equal(await requestCancel(id, OTHER), null);
  assert.equal(await requestCancel(id, OWNER), "cancelled");
  assert.equal(await claimJob(W), null, "cancelled jobs are never picked up");
});

test("cancelling mid-run stops before the next step", async () => {
  const id = await createJob({ owner: OWNER, ip: null, instruction: "remove page 1 and compress", files: [await pdfFile(3)] });
  const job = await claimJob(W);
  let checks = 0;
  await processJob(job!, W, async () => ++checks > 1);
  const done = (await getOwnedJob(id, OWNER))!;
  assert.equal(done.status, "cancelled");
  assert.equal((await getJobFiles(id)).filter((f) => f.kind === "output").length, 0);
});

test("retention sweep deletes file bytes, names, instruction and results", async () => {
  const id = await createJob({ owner: OWNER, ip: null, instruction: "compress my secret contract", files: [await pdfFile(1, "secret.pdf")] });
  await run(id);
  await query("update jobs set expires_at = now() - interval '1 minute' where id = $1", [id]);
  const s = await sweep();
  assert.equal(s.purged, 1);
  const job = (await getOwnedJob(id, OWNER))!;
  assert.ok(job.purged_at);
  assert.equal(job.instruction, null);
  assert.equal(job.result, null);
  const files = await getJobFiles(id);
  assert.ok(files.every((f) => f.blob_id === null && f.name === "deleted"));
  assert.equal((await query("select count(*)::int as n from blobs")).rows[0].n, 0);
});

/* ---------------- regressions from the security review ---------------- */

function summaryProvider() {
  return new ScriptedProvider((req) =>
    req.toolName === "submit_plan"
      ? { decision: "plan", plan: { steps: [{ tool: "analyze", inputs: ["file:1"], mode: "summary" }] } }
      : { title: "S", answer_markdown: "ok", key_points: [], facts: [], records: [], not_found: [], caveats: [], injection_detected: false }
  );
}

test("re-running an instruction counts toward the AI quota (no unlimited AI via revise)", async () => {
  process.env.AI_JOBS_PER_VISITOR_PER_DAY; // default 10
  setProvider(summaryProvider());
  const id = await createJob({ owner: OWNER, ip: "iphash1", instruction: "Summarise this", files: [await pdfFile(1)] });
  let job = await run(id);
  assert.equal(job.status, "completed");
  for (let i = 0; i < 9; i++) {
    assert.ok(await reviseInstruction(id, OWNER, "iphash1", "Summarise this again"));
    job = await run(id);
    assert.equal(job.status, "completed", `run ${i + 2}`);
  }
  assert.ok(await reviseInstruction(id, OWNER, "iphash1", "Summarise this one more time"));
  job = await run(id);
  assert.equal(job.status, "failed");
  assert.equal(job.error_code, "ai_quota");
  const runs = await query("select count(*)::int as n from usage_events where kind = 'job_run' and owner_hash = $1", [OWNER]);
  assert.equal(runs.rows[0].n, 11, "every run is counted for the daily job limit too");
});

test("job limits count re-runs, and the per-IP limit applies across visitors", async () => {
  for (let i = 0; i < 60; i++) {
    await query(`insert into usage_events (owner_hash, ip_hash, kind, quantity) values ($1, 'shared-ip', 'job_run', 1)`, [`v${i}`]);
  }
  await assert.rejects(checkCreateLimits(OTHER, "shared-ip"), /Too many requests from this network/);
  await checkCreateLimits(OTHER, "different-ip");
});

test("a cancel stranded by a dead worker is resolved and purged on schedule", async () => {
  const id = await createJob({ owner: OWNER, ip: null, instruction: "compress", files: [await pdfFile(1)] });
  await claimJob("dead-worker");
  await requestCancel(id, OWNER);
  await query("update jobs set lease_until = now() - interval '1 second' where id = $1", [id]);
  const s = await sweep();
  assert.equal(s.cancelled, 1);
  assert.equal((await getOwnedJob(id, OWNER))!.status, "cancelled");
  await query("update jobs set expires_at = now() - interval '1 minute' where id = $1", [id]);
  assert.equal((await sweep()).purged, 1);
});

test("purge removes file names that appear in error messages", async () => {
  const d = await EncDoc.create();
  d.addPage();
  await d.encrypt({ userPassword: "pw12", ownerPassword: "pw12" });
  const id = await createJob({ owner: OWNER, ip: null, instruction: "compress", files: [{ name: "salary-letter.pdf", mime: "application/pdf", bytes: await d.save() }] });
  await run(id);
  await query("update jobs set expires_at = now() - interval '1 minute' where id = $1", [id]);
  await sweep();
  const row = (await query("select * from jobs where id = $1", [id])).rows[0];
  assert.doesNotMatch(JSON.stringify(row), /salary-letter/);
});

test("a stale worker cannot write outputs into a job it no longer owns or that was purged", async () => {
  const id = await createJob({ owner: OWNER, ip: null, instruction: "compress", files: [await pdfFile(1)] });
  await claimJob("slow-worker");
  await query("update jobs set status = 'failed', purged_at = now() where id = $1", [id]);
  const wrote = await finishJob(id, "slow-worker", { status: "completed", result: {}, outputs: [{ name: "x.pdf", mime: "application/pdf", bytes: new Uint8Array([1]) }] });
  assert.equal(wrote, false);
  assert.equal((await getJobFiles(id)).filter((f) => f.kind === "output").length, 0);
});

test("verification: real quote with invented values, empty records and cross-number digit matches are NOT verified", () => {
  const docs = [{ name: "d.pdf", pages: ["Invoice INV-1001 dated 2015 00 03. Total due: R 1,250.00"] }];
  const base = { title: "", answer_markdown: "", key_points: [], facts: [], not_found: [], caveats: [], injection_detected: false };
  const v = verify(
    {
      ...base,
      records: [
        { doc: 1, page: 1, quote: "Invoice INV-1001", fields: [{ name: "Total", value: "R 9,999.00" }] }, // invented value
        { doc: 1, page: 1, quote: "Invoice INV-1001", fields: [{ name: "Total", value: "" }] }, // nothing extracted
        { doc: 1, page: 1, quote: "Invoice INV-1001", fields: [{ name: "Total", value: "1500" }] }, // "2015 00" must not match
        { doc: 1, page: 1, quote: "Total due: R 1,250.00", fields: [{ name: "Total", value: "1250.00" }] }, // reformatted, real
      ],
    },
    docs
  );
  assert.deepEqual(v.records.map((r) => r.verified), [false, false, false, true]);
});
