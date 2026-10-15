export type Route =
  | { kind: "ai"; task: "summarise" | "ask" }
  | { kind: "tool"; tool: string; href: string; message: string }
  | { kind: "unsupported"; message: string }
  | { kind: "clarify"; message: string };

const TOOLS: { re: RegExp; tool: string; href: string }[] = [
  { re: /\b(merge|combine|join)\b/i, tool: "Merge PDF", href: "/merge" },
  { re: /\b(split|extract pages?|remove pages?|delete pages?|reorder)\b/i, tool: "Split PDF", href: "/split" },
  { re: /\b(compress|shrink|reduce (the )?size|smaller)\b/i, tool: "Compress PDF", href: "/compress" },
  { re: /\brotate\b/i, tool: "Rotate PDF", href: "/rotate" },
  { re: /\bwatermark\b/i, tool: "Watermark PDF", href: "/watermark" },
  { re: /\b(password|encrypt|protect)\b/i, tool: "Password Protect", href: "/protect" },
  { re: /\b(to|into|as) (jpg|jpeg|png|images?)\b/i, tool: "PDF to JPG", href: "/pdf-to-jpg" },
];
const UNSUPPORTED =
  /\b(translate|translation|ocr|to word|to docx|to excel|to xlsx|to csv|compare)\b/i;
const READ = /\b(summar|explain|what|who|when|where|why|how|list|key|tell me|find|does|is there|extract|main|overview|risks?|obligations?|dates?)\b|\?/i;

/**
 * Deterministic routing: the model never decides which tool runs.
 * Document-understanding requests go to the AI task; file operations go to
 * the existing deterministic tools until the engine can run them server-side.
 */
export function routeInstruction(instruction: string): Route {
  const t = instruction.trim();
  if (t.length < 3) return { kind: "clarify", message: "Tell Peedf what you need, for example “Summarise this document”." };
  const reads = READ.test(t);
  if (UNSUPPORTED.test(t) && !/summar/i.test(t)) {
    return {
      kind: "unsupported",
      message:
        "That isn't available yet (translation, comparison, OCR and Word/Excel conversion are coming). For now I can summarise, answer questions about, and extract facts from text-based PDFs.",
    };
  }
  for (const x of TOOLS) {
    if (x.re.test(t) && !(reads && /summar|what|\?/i.test(t))) {
      return {
        kind: "tool",
        tool: x.tool,
        href: x.href,
        message: `That's a file operation. ${x.tool} does it right in your browser, with no upload.`,
      };
    }
  }
  return { kind: "ai", task: /summar|overview|tl;?dr|gist/i.test(t) ? "summarise" : "ask" };
}
