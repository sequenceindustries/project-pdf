import { analyze, reportMarkdown, type AnalysisResult, type DocText } from "./analyze";
import type { LlmProvider, LlmUsage } from "./llm";
import { OpError, type Blob } from "./ops";
import { deliverableSteps, describeTool, type Plan, type Step } from "./plan";
import { runInSandbox, type SandboxOptions } from "./sandbox";
import type { SandboxOp } from "./sandbox-types";

/**
 * Runs a validated plan. Deterministic steps run in the sandbox; analyze
 * steps extract text in the sandbox and call the model from here. Every
 * output is re-opened and checked before it is accepted.
 */

export type ExecDeps = {
  sandbox: SandboxOptions;
  llm: LlmProvider | null;
  analysisModel: string;
  singlePassChars: number;
  maxChunks: number;
  progress: (p: { step: number; total: number; message: string; phase: "processing" | "validating" }) => Promise<void>;
  isCancelled: () => Promise<boolean>;
};

export type ExecResult = {
  outputs: Blob[];
  analyses: AnalysisResult[];
  notes: string[];
  usage: LlmUsage[];
};

export class CancelledError extends Error {}

const SIMPLE_OPS: Partial<Record<Step["tool"], SandboxOp>> = {
  extract_pages: "extract_pages",
  remove_pages: "remove_pages",
  reorder_pages: "reorder_pages",
  rotate: "rotate",
  compress: "compress",
  pdf_to_images: "pdf_to_images",
  extract_text: "extract_text",
};

function resolve(refs: string[], uploads: Blob[], results: Blob[][]): Blob[] {
  return refs.flatMap((r) => {
    const [t, n] = r.split(":");
    return t === "file" ? [uploads[Number(n) - 1]] : results[Number(n) - 1];
  });
}

function uniqueNames(blobs: Blob[]) {
  const seen = new Map<string, number>();
  return blobs.map((b) => {
    const k = b.name.toLowerCase();
    const n = seen.get(k) ?? 0;
    seen.set(k, n + 1);
    if (!n) return b;
    const dot = b.name.lastIndexOf(".");
    return { ...b, name: dot > 0 ? `${b.name.slice(0, dot)}-${n + 1}${b.name.slice(dot)}` : `${b.name}-${n + 1}` };
  });
}

export async function executePlan(plan: Plan, uploads: Blob[], deps: ExecDeps): Promise<ExecResult> {
  const results: Blob[][] = [];
  const analyses: AnalysisResult[] = [];
  const notes: string[] = [];
  const usage: LlmUsage[] = [];
  const total = plan.steps.length;
  const keep = deliverableSteps(plan);
  const run = <T,>(op: SandboxOp, inputs: Blob[], args: Record<string, unknown> = {}) => runInSandbox<T>(op, inputs, args, deps.sandbox);

  for (let i = 0; i < total; i++) {
    if (await deps.isCancelled()) throw new CancelledError();
    const step = plan.steps[i];
    const inputs = resolve(step.inputs, uploads, results);
    await deps.progress({ step: i + 1, total, message: `${capital(describeTool(step.tool))}…`, phase: "processing" });

    let out: Blob[] = [];
    switch (step.tool) {
      case "merge":
        out = [await run<Blob>("merge", inputs)];
        break;
      case "images_to_pdf":
        out = [await run<Blob>("images_to_pdf", inputs)];
        break;
      case "analyze": {
        if (!deps.llm) throw new OpError("ai_not_configured", "AI analysis isn't switched on yet.");
        const docs: DocText[] = [];
        for (const b of inputs) docs.push({ name: b.name, pages: await run<string[]>("text_pages", [b]) });
        const { result, usage: u } = await analyze(deps.llm, step, docs, {
          model: deps.analysisModel,
          singlePassChars: deps.singlePassChars,
          maxChunks: deps.maxChunks,
          onProgress: (m) => {
            // Progress is best-effort; a failed write must never crash the worker.
            deps.progress({ step: i + 1, total, message: m, phase: "processing" }).catch(() => {});
          },
          isCancelled: deps.isCancelled,
        }).catch((e: Error & { code?: string }) => {
          if (e.code === "cancelled") throw new CancelledError();
          if (e.code === "no_text" || e.code === "too_long") throw new OpError(e.code, e.message);
          throw e;
        });
        usage.push(...u);
        analyses.push(result);
        await deps.progress({ step: i + 1, total, message: "Checking quotes against the source…", phase: "validating" });
        const base = step.mode === "extract" ? "extracted" : step.mode === "compare" ? "comparison" : step.mode === "answer" ? "answer" : "summary";
        const wantFile = step.output ?? (step.mode === "extract" ? "xlsx" : "pdf");
        if (step.mode === "extract" && (wantFile === "xlsx" || wantFile === "csv")) {
          const fields = result.fields;
          const multi = result.documents.length > 1;
          const columns = [...fields, ...(multi ? ["Document"] : []), "Page", "Verified against source"];
          const rows = result.records.map((r) => [
            ...fields.map((f) => r.fields.find((x) => x.name.toLowerCase() === f.toLowerCase())?.value ?? ""),
            ...(multi ? [result.documents[r.doc - 1]?.name ?? String(r.doc)] : []),
            String(r.page),
            r.verified ? "Yes" : "No - check original",
          ]);
          out.push(await run<Blob>("render_table", [], { format: wantFile, columns, rows, name: base }));
        }
        if (wantFile === "pdf" || step.mode !== "extract") {
          if (wantFile !== "none") {
            const pdf = await run<Blob>("render_report", [], {
              title: result.title || "Summary",
              markdown: reportMarkdown(result),
              footer: "Generated by peedf AI - verify important details against the original",
            });
            out.push({ ...pdf, name: `${base}.pdf` });
          }
        }
        break;
      }
      default: {
        const op = SIMPLE_OPS[step.tool]!;
        const args = { ...step, inputs: undefined } as Record<string, unknown>;
        for (const b of inputs) {
          if (await deps.isCancelled()) throw new CancelledError();
          out.push(await run<Blob>(op, [b], args));
        }
      }
    }

    // Validate every produced file before accepting the step.
    await deps.progress({ step: i + 1, total, message: "Checking the result…", phase: "validating" });
    for (const b of out) {
      const expect = b.mime === "application/pdf" && typeof b.pages === "number" ? { pages: b.pages } : {};
      await run("validate", [b], { expect });
      if (step.tool === "compress" && b.meta?.method === "none") {
        notes.push(`${b.name.replace(/-compressed\.pdf$/, ".pdf")} was already well optimised; compressing it didn't make it smaller, so it's unchanged.`);
      } else if (step.tool === "compress" && b.meta?.method === "raster") {
        notes.push(`${b.name}: pages were redrawn as images to save space, so text in this copy is no longer selectable.`);
      }
    }
    results.push(out);
  }

  const outputs = uniqueNames(results.flatMap((r, i) => (keep.has(i) ? r : [])));
  return { outputs, analyses, notes, usage };
}

function capital(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
