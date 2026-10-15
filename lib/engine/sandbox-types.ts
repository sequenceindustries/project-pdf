import type { Blob } from "./ops";

export type SandboxOp =
  | "inspect"
  | "merge"
  | "extract_pages"
  | "remove_pages"
  | "reorder_pages"
  | "rotate"
  | "compress"
  | "pdf_to_images"
  | "images_to_pdf"
  | "extract_text"
  | "text_pages"
  | "render_report"
  | "render_table"
  | "validate";

export type SandboxRequest = { op: SandboxOp; args: Record<string, unknown>; inputs: Blob[] };
