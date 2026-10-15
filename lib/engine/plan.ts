import { z } from "zod";
import { parsePageOrder, parsePageSpec } from "./pages";

/**
 * The task engine's contract: a Plan is a short, bounded list of steps over a
 * closed set of tools. Whoever produces a plan (rules or AI), it is parsed with
 * this schema and checked by validatePlan() against the real files before
 * anything runs. The AI can only choose from these tools and arguments.
 */

export const Ref = z
  .string()
  .regex(/^(file|step):\d{1,2}$/)
  .describe('"file:N" is uploaded file N (1-based). "step:N" is every output of step N.');

const PageSpec = z.string().min(1).max(200).describe('1-based pages, e.g. "5-8", "1,3,10-12", "2-last".');

export const StepSchema = z.discriminatedUnion("tool", [
  z.object({ tool: z.literal("merge"), inputs: z.array(Ref).min(1).max(10) }),
  z.object({ tool: z.literal("extract_pages"), inputs: z.array(Ref).min(1).max(10), pages: PageSpec }),
  z.object({ tool: z.literal("remove_pages"), inputs: z.array(Ref).min(1).max(10), pages: PageSpec }),
  z.object({
    tool: z.literal("reorder_pages"),
    inputs: z.array(Ref).min(1).max(1),
    order: z.string().min(1).max(400).describe('Every page once, e.g. "3,1,2", or "reverse".'),
  }),
  z.object({
    tool: z.literal("rotate"),
    inputs: z.array(Ref).min(1).max(10),
    angle: z.union([z.literal(90), z.literal(180), z.literal(270)]).describe("Clockwise degrees. Left = 270."),
    pages: PageSpec.optional(),
  }),
  z.object({
    tool: z.literal("compress"),
    inputs: z.array(Ref).min(1).max(10),
    level: z.enum(["light", "recommended", "strong"]),
  }),
  z.object({ tool: z.literal("images_to_pdf"), inputs: z.array(Ref).min(1).max(10) }),
  z.object({ tool: z.literal("pdf_to_images"), inputs: z.array(Ref).min(1).max(10), pages: PageSpec.optional() }),
  z.object({ tool: z.literal("extract_text"), inputs: z.array(Ref).min(1).max(10) }),
  z.object({
    tool: z.literal("analyze"),
    inputs: z.array(Ref).min(1).max(5),
    mode: z.enum(["summary", "answer", "explain", "extract", "compare"]),
    question: z.string().max(600).optional().describe("For answer/explain/compare: what the user wants to know."),
    fields: z.array(z.string().min(1).max(60)).max(20).optional().describe("For extract: the fields/columns to pull out."),
    length: z.enum(["short", "standard", "detailed"]).optional(),
    output: z.enum(["pdf", "xlsx", "csv", "none"]).optional().describe("Downloadable file to produce in addition to the on-screen result."),
  }),
]);

export const PlanSchema = z.object({
  steps: z.array(StepSchema).min(1).max(8),
});

export type Step = z.infer<typeof StepSchema>;
export type Plan = z.infer<typeof PlanSchema>;
export type ToolName = Step["tool"];

export type FileInfo = {
  n: number; // 1-based
  kind: "pdf" | "image";
  pages: number;
  scanned?: boolean;
  encrypted?: boolean;
};

type Artifact = { kind: "pdf" | "image" | "images" | "text" | "report"; pages?: number; scanned?: boolean; encrypted?: boolean };

export type Validation = { ok: true; aiPages: number; usesAi: boolean } | { ok: false; error: string };

const SINGLE_INPUT_PDF_TOOLS = new Set<ToolName>([
  "extract_pages",
  "remove_pages",
  "reorder_pages",
  "rotate",
  "compress",
  "pdf_to_images",
  "extract_text",
]);

export function describeTool(t: ToolName) {
  return {
    merge: "merge",
    extract_pages: "extract pages",
    remove_pages: "remove pages",
    reorder_pages: "reorder pages",
    rotate: "rotate",
    compress: "compress",
    images_to_pdf: "convert images to PDF",
    pdf_to_images: "convert to images",
    extract_text: "extract text",
    analyze: "analyse with AI",
  }[t];
}

/**
 * Checks a plan against the real uploaded files: references, input types,
 * page ranges (tracked through every step), encryption, scanned documents,
 * and AI limits. Returns a user-readable error for anything that can't run.
 */
export function validatePlan(
  plan: Plan,
  files: FileInfo[],
  opts: { maxSteps: number; maxAiPages: number; aiAvailable: boolean }
): Validation {
  if (plan.steps.length > opts.maxSteps) return { ok: false, error: `That needs more than ${opts.maxSteps} steps. Try splitting it into two requests.` };
  const outputs: Artifact[][] = [];
  let aiPages = 0;
  let usesAi = false;

  for (let s = 0; s < plan.steps.length; s++) {
    const step = plan.steps[s];
    const label = `Step ${s + 1} (${describeTool(step.tool)})`;
    const inputs: Artifact[] = [];
    for (const ref of step.inputs) {
      const [type, raw] = ref.split(":");
      const n = Number(raw);
      if (type === "file") {
        const f = files.find((x) => x.n === n);
        if (!f) return { ok: false, error: `${label} refers to file ${n}, but only ${files.length} file${files.length === 1 ? " was" : "s were"} uploaded.` };
        inputs.push({ kind: f.kind, pages: f.pages, scanned: f.scanned, encrypted: f.encrypted });
      } else {
        if (n < 1 || n > s) return { ok: false, error: `${label} uses a result that isn't available yet.` };
        inputs.push(...outputs[n - 1]);
      }
    }
    if (!inputs.length) return { ok: false, error: `${label} has no input.` };

    const pdfs = inputs.filter((a) => a.kind === "pdf");
    if (step.tool !== "images_to_pdf" && pdfs.length !== inputs.length) {
      return { ok: false, error: `${label} needs PDF files, but was given ${inputs.find((a) => a.kind !== "pdf")!.kind === "image" ? "an image" : "a result that isn't a PDF"}.` };
    }
    if (step.tool === "images_to_pdf" && inputs.some((a) => a.kind !== "image")) {
      return { ok: false, error: `${label} only accepts JPG or PNG images.` };
    }
    if (inputs.some((a) => a.encrypted)) {
      return { ok: false, error: "One of the PDFs is password-protected. Remove the password first, then try again." };
    }

    const out: Artifact[] = [];
    switch (step.tool) {
      case "merge": {
        if (inputs.length < 2) return { ok: false, error: "Merging needs at least two PDFs." };
        out.push({ kind: "pdf", pages: sum(inputs), scanned: inputs.every((a) => a.scanned) });
        break;
      }
      case "extract_pages":
      case "remove_pages": {
        for (const a of inputs) {
          const r = parsePageSpec(step.pages, a.pages ?? 0);
          if (!r.ok) return { ok: false, error: r.error };
          const n = step.tool === "extract_pages" ? r.indices.length : (a.pages ?? 0) - r.indices.length;
          if (n < 1) return { ok: false, error: "That would leave an empty PDF." };
          out.push({ kind: "pdf", pages: n, scanned: a.scanned });
        }
        break;
      }
      case "reorder_pages": {
        const r = parsePageOrder(step.order, inputs[0].pages ?? 0);
        if (!r.ok) return { ok: false, error: r.error };
        out.push({ ...inputs[0] });
        break;
      }
      case "rotate": {
        for (const a of inputs) {
          if (step.pages) {
            const r = parsePageSpec(step.pages, a.pages ?? 0);
            if (!r.ok) return { ok: false, error: r.error };
          }
          out.push({ ...a });
        }
        break;
      }
      case "compress":
        // Raster compression can drop the text layer; the executor re-checks text before any AI step.
        inputs.forEach((a) => out.push({ ...a }));
        break;
      case "images_to_pdf":
        out.push({ kind: "pdf", pages: inputs.length, scanned: true });
        break;
      case "pdf_to_images":
        for (const a of inputs) {
          if (step.pages) {
            const r = parsePageSpec(step.pages, a.pages ?? 0);
            if (!r.ok) return { ok: false, error: r.error };
          }
          out.push({ kind: "images" });
        }
        break;
      case "extract_text":
        if (inputs.some((a) => a.scanned)) {
          return { ok: false, error: "This looks like a scanned document with no text layer. Text recognition (OCR) isn't available yet." };
        }
        inputs.forEach(() => out.push({ kind: "text" }));
        break;
      case "analyze": {
        if (!opts.aiAvailable) return { ok: false, error: "AI document analysis isn't switched on yet. PDF operations like merge, split, rotate and compress work now." };
        if (inputs.some((a) => a.scanned)) {
          return { ok: false, error: "This looks like a scanned document with no text layer. AI analysis needs readable text, and text recognition (OCR) isn't available yet." };
        }
        if ((step.mode === "answer" || step.mode === "explain") && !step.question?.trim()) {
          return { ok: false, error: "What would you like to know about the document?" };
        }
        if (step.mode === "extract" && !step.fields?.length) {
          return { ok: false, error: "Which details should I extract? For example: invoice number, date, total." };
        }
        if (step.mode === "compare" && inputs.length < 2) {
          return { ok: false, error: "Comparing needs at least two documents." };
        }
        aiPages += sum(inputs);
        usesAi = true;
        out.push({ kind: "report" });
        break;
      }
    }
    outputs.push(out);
  }
  if (aiPages > opts.maxAiPages) {
    return { ok: false, error: `AI analysis is limited to ${opts.maxAiPages} pages per request; this needs ${aiPages}. Try extracting the relevant pages first.` };
  }
  return { ok: true, aiPages, usesAi };
}

function sum(a: Artifact[]) {
  return a.reduce((n, x) => n + (x.pages ?? 0), 0);
}

/** Steps whose outputs are not consumed by a later step are what the user downloads. */
export function deliverableSteps(plan: Plan): Set<number> {
  const consumed = new Set<number>();
  plan.steps.forEach((s) =>
    s.inputs.forEach((r) => {
      if (r.startsWith("step:")) consumed.add(Number(r.slice(5)) - 1);
    })
  );
  return new Set(plan.steps.map((_, i) => i).filter((i) => !consumed.has(i) || plan.steps[i].tool === "analyze"));
}
