/**
 * Example tasks shown under the workspace. Every example feeds the same
 * instruction box. `needs` says what must be switched on for it to work;
 * "soon" marks features that are not built yet, shown as such rather than
 * offered and then failing.
 */

export type Example = { prompt: string; needs: "none" | "ai" | "soon"; files?: "one" | "many" | "images" };

export const exampleGroups: { id: string; title: string; examples: Example[] }[] = [
  {
    id: "understand",
    title: "Understand documents",
    examples: [
      { prompt: "Summarise this document and list the key dates.", needs: "ai" },
      { prompt: "Explain this contract in simple language.", needs: "ai" },
      { prompt: "What are the payment terms?", needs: "ai" },
    ],
  },
  {
    id: "edit",
    title: "Edit PDFs",
    examples: [
      { prompt: "Remove pages 5–8 and compress the rest.", needs: "none" },
      { prompt: "Merge these PDFs in this order.", needs: "none", files: "many" },
      { prompt: "Rotate page 2 left.", needs: "none" },
      { prompt: "Reverse the page order.", needs: "none" },
      { prompt: "Keep only pages 1–3.", needs: "none" },
    ],
  },
  {
    id: "convert",
    title: "Convert documents",
    examples: [
      { prompt: "Convert every page to JPG.", needs: "none" },
      { prompt: "Turn these images into one PDF.", needs: "none", files: "images" },
      { prompt: "Extract the text.", needs: "none" },
      { prompt: "Convert this PDF to an editable Word document.", needs: "soon" },
    ],
  },
  {
    id: "extract",
    title: "Extract information",
    examples: [
      { prompt: "Extract invoice numbers, dates and totals into Excel.", needs: "ai" },
      { prompt: "List every name, company and amount mentioned.", needs: "ai" },
    ],
  },
  {
    id: "compare",
    title: "Compare documents",
    examples: [
      { prompt: "Compare these two documents and list the differences.", needs: "ai", files: "many" },
      { prompt: "Compare these supplier quotes and rank them by price.", needs: "ai", files: "many" },
    ],
  },
  {
    id: "translate",
    title: "Translate documents",
    examples: [{ prompt: "Translate this PDF into English.", needs: "soon" }],
  },
  {
    id: "compress",
    title: "Compress and optimise",
    examples: [
      { prompt: "Compress this PDF.", needs: "none" },
      { prompt: "Make it as small as possible for email.", needs: "none" },
    ],
  },
];
