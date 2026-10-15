import { aiPlan } from "../lib/engine/ai-planner";
import { CancelledError, executePlan } from "../lib/engine/execute";
import { AnthropicProvider, LlmError, type LlmProvider, type LlmUsage } from "../lib/engine/llm";
import { OpError, type Blob, type Inspection } from "../lib/engine/ops";
import { PlanSchema, validatePlan, type FileInfo, type Plan } from "../lib/engine/plan";
import { rulePlan } from "../lib/engine/rule-planner";
import { runInSandbox } from "../lib/engine/sandbox";
import { aiConfigured, config } from "../lib/server/config";
import { emit } from "../lib/server/events";
import {
  aiRunsToday,
  finishJob,
  getJobFiles,
  recordAiRun,
  recordUsage,
  retryLater,
  savePlan,
  setInputMeta,
  setProgress,
  type JobRow,
} from "../lib/server/jobs";
import { getBlob } from "../lib/server/storage";

let provider: LlmProvider | null | undefined;
export function setProvider(p: LlmProvider | null) {
  provider = p;
}
function llm(): LlmProvider | null {
  if (provider === undefined) provider = aiConfigured() ? new AnthropicProvider(config.ai.apiKey, config.ai.timeoutMs) : null;
  return provider;
}

const sandbox = () => ({ timeoutMs: config.limits.stepTimeoutMs, memoryMb: config.limits.sandboxMemoryMb });

const HELP =
  "I couldn't work out what to do. Try something like “Remove pages 5–8 and compress”, “Merge these PDFs”, “Rotate page 2 left” or “Convert to JPG”.";

/**
 * Processes one claimed job end to end. Every exit path records a final
 * status; nothing is reported as completed unless outputs passed validation.
 */
export async function processJob(job: JobRow, workerId: string, isCancelled: () => Promise<boolean>) {
  const started = Date.now();
  const usage: LlmUsage[] = [];
  let planner = job.planner ?? "rules";
  emit("job_started", { job: job.id, attempt: job.attempts });

  try {
    // 1. Load inputs.
    const rows = (await getJobFiles(job.id)).filter((f) => f.kind === "input");
    const uploads: Blob[] = [];
    for (const r of rows) {
      const data = r.blob_id ? await getBlob(r.blob_id) : null;
      if (!data) throw new OpError("input_missing", "The uploaded files are no longer available. Please upload them again.");
      uploads.push({ name: r.name, mime: r.mime, bytes: new Uint8Array(data.buffer, data.byteOffset, data.byteLength) });
    }

    // 2. Inspect each file in the sandbox (page count, encryption, text layer).
    await setProgress(job.id, workerId, "processing", { message: "Reading your files…" });
    const files: (FileInfo & { name: string })[] = [];
    for (let i = 0; i < uploads.length; i++) {
      const info = await runInSandbox<Inspection>("inspect", [uploads[i]], {}, sandbox());
      if (info.pages > config.limits.maxPagesPerFile) {
        throw new OpError("too_many_pages", `${uploads[i].name} has ${info.pages} pages; the limit is ${config.limits.maxPagesPerFile} per file.`);
      }
      uploads[i].pages = info.pages;
      await setInputMeta(rows[i].id, job.id, workerId, info.pages, { scanned: info.scanned ?? false, encrypted: info.encrypted });
      files.push({ n: i + 1, name: uploads[i].name, kind: info.kind, pages: info.pages, scanned: info.scanned, encrypted: info.encrypted });
    }

    // 3. Plan: reuse a saved plan on retry; otherwise rules first, AI if needed.
    let plan: Plan | null = job.plan ? PlanSchema.parse(job.plan) : null;
    if (!plan) {
      await setProgress(job.id, workerId, "processing", { message: "Working out the steps…" });
      const instruction = job.instruction ?? "";
      const rules = rulePlan(instruction, files);
      if (rules.complete) {
        plan = rules.plan;
        planner = "rules";
      } else if (llm()) {
        const r = await aiPlan(llm()!, config.ai.plannerModel, instruction, files);
        usage.push(r.usage);
        planner = "ai";
        if (r.kind === "clarify") return await stop("needs_input", "clarify", r.question);
        if (r.kind === "unsupported") return await stop("needs_input", "unsupported", r.reason);
        plan = r.plan;
      } else {
        const wantsAi = rules.reason === "needs_ai";
        return await stop(
          "needs_input",
          wantsAi ? "ai_not_configured" : "unclear",
          wantsAi
            ? "AI document analysis (summaries, questions, extraction) isn't switched on yet. PDF operations like merge, split, remove pages, rotate and compress work now."
            : HELP
        );
      }
    }

    // 4. Validate against the real files before running anything.
    const v = validatePlan(plan, files, {
      maxSteps: config.limits.maxStepsPerPlan,
      maxAiPages: config.limits.maxAiPagesPerJob,
      aiAvailable: Boolean(llm()),
    });
    if (!v.ok) return await stop("needs_input", "invalid_plan", v.error, { plan });
    if (v.usesAi) {
      const used = await aiRunsToday(job.owner_hash, job.ip_hash);
      if (used.owner >= config.limits.aiJobsPerVisitorPerDay || used.ip >= config.limits.aiJobsPerIpPerDay) {
        return await stop("failed", "ai_quota", "You've used today's AI analyses. PDF operations still work, and AI analysis resets within 24 hours.");
      }
      // Counted before any analysis call, so failed or cancelled runs still count.
      await recordAiRun(job.id, job.owner_hash, job.ip_hash, v.aiPages);
    }
    await savePlan(job.id, workerId, plan, planner, v.usesAi);

    // 5. Execute.
    let lastWrite = 0;
    const res = await executePlan(plan, uploads, {
      sandbox: sandbox(),
      llm: llm(),
      analysisModel: config.ai.analysisModel,
      singlePassChars: config.ai.singlePassChars,
      maxChunks: config.ai.maxChunks,
      isCancelled,
      progress: async (p) => {
        const now = Date.now();
        if (now - lastWrite < 400 && p.phase === "processing") return;
        lastWrite = now;
        await setProgress(job.id, workerId, p.phase, { step: p.step, total: p.total, message: p.message });
      },
    });
    usage.push(...res.usage);

    if (!res.outputs.length && !res.analyses.length) throw new OpError("empty_output", "The request finished without producing anything.");

    // 6. Store outputs + result in one transaction.
    await finishJob(job.id, workerId, {
      status: "completed",
      outputs: res.outputs,
      result: { plan, planner, analyses: res.analyses, notes: res.notes },
    });
    await recordUsage(job.id, job.owner_hash, [
      { kind: "job_completed", tool: plan.steps.map((s) => s.tool).join("+"), quantity: 1 },
      { kind: "pages_processed", quantity: files.reduce((n, f) => n + f.pages, 0) },
      ...(v.usesAi ? [{ kind: "ai_pages", quantity: v.aiPages }] : []),
      ...usage.map((u) => ({ kind: "ai_tokens", model: u.model, inputTokens: u.inputTokens, outputTokens: u.outputTokens })),
    ]);
    emit("job_completed", {
      job: job.id,
      planner,
      steps: plan.steps.length,
      tools: plan.steps.map((s) => s.tool).join("+"),
      pages: files.reduce((n, f) => n + f.pages, 0),
      outputs: res.outputs.length,
      ai_calls: usage.length,
      ai_input_tokens: sum(usage, "inputTokens"),
      ai_output_tokens: sum(usage, "outputTokens"),
      ai_cost_usd: cost(usage),
      verified: res.analyses.reduce((n, a) => n + a.verification.verified, 0),
      checked: res.analyses.reduce((n, a) => n + a.verification.checked, 0),
      duration_ms: Date.now() - started,
    });
  } catch (e) {
    if (e instanceof CancelledError) {
      await finishJob(job.id, workerId, { status: "cancelled", code: "cancelled", message: "Cancelled." });
      emit("job_cancelled", { job: job.id });
    } else if (e instanceof LlmError && e.retryable && job.attempts < job.max_attempts) {
      const delay = 15 * 2 ** (job.attempts - 1);
      await retryLater(job.id, workerId, e.code, e.message, delay);
      emit("job_retry", { job: job.id, code: e.code, attempt: job.attempts, delay_s: delay }, "warn");
    } else if (e instanceof LlmError || e instanceof OpError) {
      await stop("failed", e.code, e.message);
    } else if (job.attempts < job.max_attempts) {
      await retryLater(job.id, workerId, "internal", "Something went wrong. Retrying…", 10);
      emit("job_retry", { job: job.id, code: "internal", attempt: job.attempts, error: errName(e) }, "warn");
    } else {
      await stop("failed", "internal", "Something went wrong while processing. Please try again.");
      emit("step_failed", { job: job.id, error: errName(e) }, "error");
    }
    if (usage.length) {
      await recordUsage(job.id, job.owner_hash, usage.map((u) => ({ kind: "ai_tokens", model: u.model, inputTokens: u.inputTokens, outputTokens: u.outputTokens })));
    }
  }

  async function stop(status: "needs_input" | "failed", code: string, message: string, result?: unknown) {
    await finishJob(job.id, workerId, { status, code, message, result });
    emit(status === "failed" ? "job_failed" : "job_needs_input", { job: job.id, code, planner, duration_ms: Date.now() - started }, status === "failed" ? "warn" : "info");
  }
}

function sum(u: LlmUsage[], k: "inputTokens" | "outputTokens") {
  return u.reduce((n, x) => n + x[k], 0);
}

function cost(u: LlmUsage[]) {
  const { priceInputPerMTok: pi, priceOutputPerMTok: po } = config.ai;
  if (!pi || !po || !u.length) return null;
  return Math.round(((sum(u, "inputTokens") * pi + sum(u, "outputTokens") * po) / 1e6) * 10000) / 10000;
}

function errName(e: unknown) {
  // Error class and code only: messages from libraries or Postgres can echo input values.
  if (!(e instanceof Error)) return "unknown";
  const code = (e as { code?: unknown }).code;
  return typeof code === "string" ? `${e.name}:${code.slice(0, 40)}` : e.name;
}
