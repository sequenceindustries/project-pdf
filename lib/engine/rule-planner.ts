import type { FileInfo, Plan, Step } from "./plan";

/**
 * Deterministic planner for clear, common instructions ("remove pages 5-8 and
 * compress", "merge these", "summarise this"). It costs nothing and is
 * predictable, so it runs first. If any part of the instruction isn't
 * understood, it reports `complete: false` and the AI planner takes over
 * (or, without AI, the user gets a clarification).
 */

export type RulePlan = { complete: true; plan: Plan } | { complete: false; reason: string };

const PAGES = String.raw`(?:pages?|pp?\.?)\s*((?:\d+|last|end)(?:\s*(?:-|–|—|to|,|and|&)\s*(?:\d+|last|end))*)`;

function normalise(s: string) {
  return s
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/\s+/g, " ")
    .replace(/(\d)\s*(?:–|—)\s*(\d)/g, "$1-$2")
    .replace(/(\d)\s+to\s+(\d)/g, "$1-$2")
    .replace(/(\d)\s*(?:and|&)\s*(\d)/g, "$1,$2")
    .trim();
}

function pageSpec(clause: string): string | null {
  const m = clause.match(new RegExp(PAGES, "i"));
  if (!m) return null;
  return m[1].replace(/\s*(and|&)\s*/g, ",").replace(/\s+/g, "");
}

/** Splits "remove pages 5-8 and compress the rest, then merge" into clauses. */
function clauses(s: string): string[] {
  return s
    .split(/\s*(?:\.\s+|;\s*|,?\s+and then\s+|,?\s+then\s+|,\s+|\s+and\s+(?=(?:also\s+)?(?:remove|delete|drop|extract|keep|split|rotate|turn|compress|shrink|reduce|make|merge|combine|join|convert|turn|summar|explain|reorder|reverse|extract|pull|find|list|translate|ocr)))/)
    .map((c) => c.trim().replace(/^(please|can you|could you|i want to|i need to|help me)\s+/, ""))
    .filter((c) => c.length > 1);
}

type StepNoInputs = Step extends infer S ? (S extends Step ? Omit<S, "inputs"> : never) : never;
type Parsed =
  | { step: StepNoInputs; ai?: false }
  | { ai: true }
  | null;

function parseClause(c: string, files: FileInfo[]): Parsed {
  const pdfCount = files.filter((f) => f.kind === "pdf").length;
  const imgCount = files.filter((f) => f.kind === "image").length;

  // AI-only intents: hand to the AI planner.
  if (/\b(summar\w*|explain\w*|what|which|who|when|where|why|how (much|many|long)|does|is there|are there|find (all|the|any)|list (all|the)|translat\w*|compar\w*|key (dates|points|terms)|clauses?|obligations?|payment terms|risks?|tl;?dr|overview)\b/.test(c)) {
    return { ai: true };
  }
  if (/\bextract\b/.test(c) && !/\btext\b/.test(c) && !new RegExp(PAGES).test(c)) return { ai: true };

  if (/\b(merge|combine|join|put .* together|stitch)\b/.test(c)) {
    if (imgCount && !pdfCount) return { step: { tool: "images_to_pdf" } };
    return { step: { tool: "merge" } };
  }
  if (/\b(remove|delete|drop|take out|get rid of|cut)\b/.test(c)) {
    const spec = pageSpec(c);
    if (!spec) return null;
    return { step: { tool: "remove_pages", pages: spec } };
  }
  if (/\b(extract|keep|split|pull out|separate|only)\b/.test(c)) {
    const spec = pageSpec(c);
    if (spec) return { step: { tool: "extract_pages", pages: spec } };
    if (/\bextract (all )?(the )?text\b/.test(c)) return { step: { tool: "extract_text" } };
    return null;
  }
  if (/\b(reverse)\b.*\border\b|\breverse (the )?pages\b/.test(c)) return { step: { tool: "reorder_pages", order: "reverse" } };
  if (/\b(reorder|rearrange|re-order|put the pages in)\b/.test(c)) {
    const m = c.match(/((?:\d+|last)(?:\s*[,\s-]\s*(?:\d+|last))+)/);
    if (!m) return null;
    return { step: { tool: "reorder_pages", order: m[1].replace(/\s+/g, "") } };
  }
  if (/\brotate\b/.test(c) || (/\bturn\b/.test(c) && !/\b(into|to)\b/.test(c))) {
    const angle = /\b(180|upside[- ]down)\b/.test(c)
      ? 180
      : /\b(left|anti-?clockwise|counter-?clockwise|270)\b/.test(c)
        ? 270
        : 90;
    const spec = pageSpec(c);
    return { step: { tool: "rotate", angle, ...(spec ? { pages: spec } : {}) } };
  }
  if (/\b(compress|shrink|reduce (the )?(file )?size|make (it|them|this|the file|the pdf) (smaller|as small as possible|tiny)|smaller|optimi[sz]e)\b/.test(c)) {
    const level = /\b(as small as possible|maximum|max|strong|a lot)\b/.test(c)
      ? "strong"
      : /\b(light|slightly|a little|keep (the )?quality|high quality)\b/.test(c)
        ? "light"
        : "recommended";
    return { step: { tool: "compress", level } };
  }
  if (/\b(to|into|as)\s+(jpe?g|images?|pictures?|png)s?\b/.test(c) && pdfCount) {
    const spec = pageSpec(c);
    return { step: { tool: "pdf_to_images", ...(spec ? { pages: spec } : {}) } };
  }
  if (/\b(to|into|as|make (a|it a|them a))\s+(a )?pdf\b|\bconvert\b/.test(c) && imgCount && !pdfCount) {
    return { step: { tool: "images_to_pdf" } };
  }
  if (/\b(text|txt)\b/.test(c) && /\b(extract|get|copy|export|to|into|as)\b/.test(c)) return { step: { tool: "extract_text" } };
  return null;
}

export function rulePlan(instruction: string, files: FileInfo[]): RulePlan {
  const text = normalise(instruction);
  if (!text) return { complete: false, reason: "empty" };
  const parts = clauses(text);
  const steps: Step[] = [];
  const allFiles = files.map((f) => `file:${f.n}` as const);

  for (const c of parts) {
    const parsed = parseClause(c, files);
    if (!parsed) return { complete: false, reason: `unparsed: ${c.slice(0, 40)}` };
    if (parsed.ai) return { complete: false, reason: "needs_ai" };
    const prev = steps.length ? [`step:${steps.length}`] : allFiles;
    const step = { ...parsed.step, inputs: prev } as Step;
    // Single-file reorder needs exactly one input.
    if (step.tool === "reorder_pages" && step.inputs.length !== 1) return { complete: false, reason: "ambiguous_reorder" };
    steps.push(step);
  }
  if (!steps.length) return { complete: false, reason: "nothing" };
  return { complete: true, plan: { steps } };
}
