/** ai = runs in the AI workspace today; browser = handed to an in-browser tool; soon = not built yet. */
export type PromptStatus = "ai" | "browser" | "soon";

export const PROMPT_GROUPS: { title: string; status: PromptStatus; prompts: string[] }[] = [
  { title: "Understand documents", status: "ai", prompts: ["Summarise this document", "What are the key risks in this document?", "What are the main obligations and deadlines?"] },
  { title: "Extract information", status: "ai", prompts: ["List every date and amount mentioned", "Who are the parties named in this document?"] },
  { title: "Edit PDFs", status: "browser", prompts: ["Remove the first page", "Rotate all pages 90°", "Add a watermark"] },
  { title: "Compress and optimise files", status: "browser", prompts: ["Compress this PDF", "Make this file smaller"] },
  { title: "Convert documents", status: "browser", prompts: ["Convert this PDF to images", "Convert this PDF to Word"] },
  { title: "Compare documents", status: "soon", prompts: ["Compare this with another version"] },
  { title: "Translate documents", status: "soon", prompts: ["Translate this into French"] },
];

export const PROMPT_KEY = "peedf.prompt";
export const STATUS_LABEL: Record<PromptStatus, string> = { ai: "Live", browser: "In your browser", soon: "Coming soon" };
