import { extractText, getDocumentProxy } from "unpdf";
import type { PageText } from "./jobs";

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
export const MAX_PAGES = 200;
export const MAX_CHARS = 400_000;

export class ExtractError extends Error {
  constructor(
    public code: "not_pdf" | "too_large" | "encrypted_or_corrupt" | "too_many_pages" | "scanned" | "too_much_text",
    message: string,
  ) {
    super(message);
  }
}

export async function extractPages(buf: Uint8Array): Promise<PageText[]> {
  if (buf.byteLength > MAX_UPLOAD_BYTES) throw new ExtractError("too_large", "That file is over the 20 MB limit for AI analysis.");
  const magic = new TextDecoder().decode(buf.subarray(0, 5));
  if (magic !== "%PDF-") throw new ExtractError("not_pdf", "That doesn't look like a PDF file.");
  let pages: string[];
  try {
    const pdf = await getDocumentProxy(buf);
    if (pdf.numPages > MAX_PAGES)
      throw new ExtractError("too_many_pages", `This PDF has ${pdf.numPages} pages; the limit is ${MAX_PAGES}. Try splitting it first.`);
    pages = (await extractText(pdf, { mergePages: false })).text;
  } catch (e) {
    if (e instanceof ExtractError) throw e;
    throw new ExtractError("encrypted_or_corrupt", "Couldn't read that PDF. It may be password-protected or damaged.");
  }
  const out = pages.map((t, i) => ({ n: i + 1, text: t.replace(/\s+\n/g, "\n").trim() }));
  const chars = out.reduce((s, p) => s + p.text.length, 0);
  if (out.length === 0 || chars / out.length < 25)
    throw new ExtractError(
      "scanned",
      "This PDF looks scanned (it has no selectable text). OCR for scanned documents isn't available yet.",
    );
  if (chars > MAX_CHARS)
    throw new ExtractError("too_much_text", "This document has too much text for one pass. Try splitting it into parts first.");
  return out;
}
