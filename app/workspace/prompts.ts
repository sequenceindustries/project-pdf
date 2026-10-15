export const PROMPT_GROUPS: { title: string; prompts: string[]; soon?: boolean }[] = [
  { title: "Understand documents", prompts: ["Summarise this document", "What are the key risks in this document?", "What are the main obligations and deadlines?"] },
  { title: "Edit PDFs", prompts: ["Remove the first page", "Rotate all pages 90°", "Add a watermark"] },
  { title: "Convert documents", prompts: ["Convert this PDF to images", "Convert this PDF to Word"] },
  { title: "Extract information", prompts: ["List every date and amount mentioned", "Who are the parties named in this document?"] },
  { title: "Compare documents", prompts: ["Compare this with another version"] },
  { title: "Translate documents", prompts: ["Translate this into French"] },
  { title: "Compress and optimise files", prompts: ["Compress this PDF", "Make this file smaller"] },
];
