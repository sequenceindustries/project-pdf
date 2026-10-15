/**
 * Deterministic document operations. Pure functions over bytes, executed
 * inside the sandbox worker (see sandbox.ts) so a malformed or hostile PDF
 * can only exhaust a disposable thread, never the worker process.
 *
 * No network, no filesystem, no shell. Relative imports only (this file is
 * loaded by a worker thread outside the Next.js bundler).
 */

import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont } from "pdf-lib";
import { createCanvas } from "@napi-rs/canvas";
import JSZip from "jszip";
import { parsePageOrder, parsePageSpec } from "./pages";

export class OpError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

export type Blob = { name: string; mime: string; bytes: Uint8Array; pages?: number; meta?: Record<string, unknown> };

async function load(b: Blob) {
  try {
    return await PDFDocument.load(b.bytes, { updateMetadata: false });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/encrypt/i.test(msg)) {
      throw new OpError("encrypted", `${b.name} is password-protected. Remove the password first, then try again.`);
    }
    throw new OpError("unreadable_pdf", `${b.name} couldn't be read as a PDF. It may be damaged.`);
  }
}

function stem(name: string) {
  return name.replace(/\.(pdf|jpe?g|png)$/i, "") || "document";
}

async function save(doc: PDFDocument, name: string, meta?: Record<string, unknown>): Promise<Blob> {
  const bytes = await doc.save({ useObjectStreams: true });
  return { name, mime: "application/pdf", bytes, pages: doc.getPageCount(), meta };
}

/* ------------------------------------------------------------------ */
/* Inspection                                                          */
/* ------------------------------------------------------------------ */

export type Inspection = {
  kind: "pdf" | "image";
  pages: number;
  encrypted: boolean;
  /** Average extractable characters per page across a sample (pdf only). */
  textCharsPerPage?: number;
  scanned?: boolean;
};

export async function inspect(b: Blob): Promise<Inspection> {
  if (b.mime !== "application/pdf") return { kind: "image", pages: 1, encrypted: false };
  let pages: number;
  try {
    const doc = await PDFDocument.load(b.bytes, { updateMetadata: false, ignoreEncryption: true });
    pages = doc.getPageCount();
    if (doc.isEncrypted) return { kind: "pdf", pages, encrypted: true };
  } catch {
    throw new OpError("unreadable_pdf", `${b.name} couldn't be read as a PDF. It may be damaged.`);
  }
  const sample = Math.min(pages, 5);
  const text = await extractTextPages(b, sample);
  const chars = text.reduce((n, t) => n + t.replace(/\s+/g, "").length, 0);
  const perPage = sample ? Math.round(chars / sample) : 0;
  return { kind: "pdf", pages, encrypted: false, textCharsPerPage: perPage, scanned: perPage < 25 };
}

/* ------------------------------------------------------------------ */
/* Page operations                                                     */
/* ------------------------------------------------------------------ */

export async function merge(inputs: Blob[]): Promise<Blob> {
  const out = await PDFDocument.create();
  for (const b of inputs) {
    const src = await load(b);
    const pages = await out.copyPages(src, src.getPageIndices());
    pages.forEach((p) => out.addPage(p));
  }
  return save(out, "merged.pdf");
}

async function copySelection(b: Blob, indices: number[], name: string) {
  const src = await load(b);
  const out = await PDFDocument.create();
  const pages = await out.copyPages(src, indices);
  pages.forEach((p) => out.addPage(p));
  return save(out, name);
}

export async function extractPages(b: Blob, spec: string): Promise<Blob> {
  const src = await load(b);
  const r = parsePageSpec(spec, src.getPageCount());
  if (!r.ok) throw new OpError("bad_pages", r.error);
  return copySelection(b, r.indices, `${stem(b.name)}-pages.pdf`);
}

export async function removePages(b: Blob, spec: string): Promise<Blob> {
  const src = await load(b);
  const count = src.getPageCount();
  const r = parsePageSpec(spec, count);
  if (!r.ok) throw new OpError("bad_pages", r.error);
  const drop = new Set(r.indices);
  const keep = src.getPageIndices().filter((i) => !drop.has(i));
  if (!keep.length) throw new OpError("bad_pages", "That would remove every page, leaving an empty PDF.");
  return copySelection(b, keep, `${stem(b.name)}-edited.pdf`);
}

export async function reorderPages(b: Blob, order: string): Promise<Blob> {
  const src = await load(b);
  const r = parsePageOrder(order, src.getPageCount());
  if (!r.ok) throw new OpError("bad_pages", r.error);
  return copySelection(b, r.indices, `${stem(b.name)}-reordered.pdf`);
}

export async function rotate(b: Blob, angle: number, spec?: string): Promise<Blob> {
  const doc = await load(b);
  const count = doc.getPageCount();
  let targets = doc.getPageIndices();
  if (spec) {
    const r = parsePageSpec(spec, count);
    if (!r.ok) throw new OpError("bad_pages", r.error);
    targets = r.indices;
  }
  for (const i of targets) {
    const page = doc.getPage(i);
    page.setRotation(degrees((page.getRotation().angle + angle) % 360));
  }
  return save(doc, `${stem(b.name)}-rotated.pdf`);
}

/* ------------------------------------------------------------------ */
/* Rendering (pdf.js + @napi-rs/canvas)                                */
/* ------------------------------------------------------------------ */

class NodeCanvasFactory {
  create(w: number, h: number) {
    const canvas = createCanvas(Math.max(1, Math.ceil(w)), Math.max(1, Math.ceil(h)));
    return { canvas, context: canvas.getContext("2d") };
  }
  reset(cc: { canvas: { width: number; height: number } }, w: number, h: number) {
    cc.canvas.width = Math.ceil(w);
    cc.canvas.height = Math.ceil(h);
  }
  destroy(cc: { canvas: { width: number; height: number } }) {
    cc.canvas.width = 0;
    cc.canvas.height = 0;
  }
}

async function openPdfjs(bytes: Uint8Array) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // Copy: pdf.js transfers/detaches the buffer it is given.
  return pdfjs.getDocument({
    data: new Uint8Array(bytes),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    CanvasFactory: NodeCanvasFactory as any,
    isEvalSupported: false,
    disableFontFace: true,
    useSystemFonts: false,
    verbosity: 0,
  }).promise;
}

async function renderPageJpeg(
  pdf: Awaited<ReturnType<typeof openPdfjs>>,
  n: number,
  scale: number,
  quality: number
) {
  const page = await pdf.getPage(n);
  const vp = page.getViewport({ scale });
  const canvas = createCanvas(Math.ceil(vp.width), Math.ceil(vp.height));
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await page.render({ canvasContext: ctx as any, viewport: vp }).promise;
  const jpg = await canvas.encode("jpeg", Math.round(quality * 100));
  const base = page.getViewport({ scale: 1 });
  page.cleanup();
  return { jpg: new Uint8Array(jpg), width: base.width, height: base.height };
}

export async function extractTextPages(b: Blob, limit?: number): Promise<string[]> {
  const pdf = await openPdfjs(b.bytes);
  const n = Math.min(pdf.numPages, limit ?? pdf.numPages);
  const out: string[] = [];
  for (let i = 1; i <= n; i++) {
    const page = await pdf.getPage(i);
    const tc = await page.getTextContent();
    let s = "";
    for (const item of tc.items as { str?: string; hasEOL?: boolean }[]) {
      if (typeof item.str !== "string") continue;
      s += item.str + (item.hasEOL ? "\n" : " ");
    }
    out.push(s.replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n").trim());
    page.cleanup();
  }
  await pdf.destroy();
  return out;
}

export async function extractText(b: Blob): Promise<Blob> {
  const pages = await extractTextPages(b);
  const body = pages.map((t, i) => `--- Page ${i + 1} ---\n${t}`).join("\n\n") + "\n";
  return {
    name: `${stem(b.name)}.txt`,
    mime: "text/plain; charset=utf-8",
    bytes: new TextEncoder().encode(body),
    meta: { pages: pages.length, chars: body.length },
  };
}

const LEVELS = {
  light: { scale: 1.6, quality: 0.85 },
  recommended: { scale: 1.3, quality: 0.72 },
  strong: { scale: 1.0, quality: 0.5 },
} as const;

export async function compress(b: Blob, level: keyof typeof LEVELS): Promise<Blob> {
  const name = `${stem(b.name)}-compressed.pdf`;
  // 1. Structural: same content, re-serialised with object streams.
  const structural = await (async () => {
    const doc = await load(b);
    doc.setProducer("");
    doc.setCreator("");
    return doc.save({ useObjectStreams: true });
  })();
  // 2. Raster: each page redrawn as a JPEG (text no longer selectable).
  let raster: Uint8Array | null = null;
  let rasterError: string | undefined;
  try {
    const pdf = await openPdfjs(b.bytes);
    const out = await PDFDocument.create();
    const { scale, quality } = LEVELS[level];
    for (let i = 1; i <= pdf.numPages; i++) {
      const { jpg, width, height } = await renderPageJpeg(pdf, i, scale, quality);
      const img = await out.embedJpg(jpg);
      out.addPage([width, height]).drawImage(img, { x: 0, y: 0, width, height });
    }
    await pdf.destroy();
    raster = await out.save();
  } catch (e) {
    raster = null;
    rasterError = (e instanceof Error ? e.message : String(e)).slice(0, 200);
  }
  const original = b.bytes.byteLength;
  const best =
    raster && raster.byteLength < structural.byteLength
      ? { bytes: raster, method: "raster" as const }
      : { bytes: structural, method: "structural" as const };
  if (best.bytes.byteLength >= original) {
    return { ...b, name, meta: { method: "none", originalBytes: original, outputBytes: original, rasterError } };
  }
  const pages = (await PDFDocument.load(best.bytes)).getPageCount();
  return {
    name,
    mime: "application/pdf",
    bytes: best.bytes,
    pages,
    meta: { method: best.method, originalBytes: original, outputBytes: best.bytes.byteLength, rasterError },
  };
}

export async function pdfToImages(b: Blob, spec?: string): Promise<Blob> {
  const pdf = await openPdfjs(b.bytes);
  let indices = Array.from({ length: pdf.numPages }, (_, i) => i);
  if (spec) {
    const r = parsePageSpec(spec, pdf.numPages);
    if (!r.ok) throw new OpError("bad_pages", r.error);
    indices = r.indices;
  }
  if (indices.length > 100) throw new OpError("too_many_pages", "PDF to images is limited to 100 pages per job.");
  const base = stem(b.name);
  const images: Uint8Array[] = [];
  for (const i of indices) images.push((await renderPageJpeg(pdf, i + 1, 2, 0.9)).jpg);
  await pdf.destroy();
  if (images.length === 1) {
    return { name: `${base}-page-${indices[0] + 1}.jpg`, mime: "image/jpeg", bytes: images[0], meta: { images: 1 } };
  }
  const zip = new JSZip();
  images.forEach((img, k) => zip.file(`${base}-page-${indices[k] + 1}.jpg`, img));
  const bytes = await zip.generateAsync({ type: "uint8array" });
  return { name: `${base}-pages.zip`, mime: "application/zip", bytes, meta: { images: images.length } };
}

export async function imagesToPdf(inputs: Blob[]): Promise<Blob> {
  const doc = await PDFDocument.create();
  for (const b of inputs) {
    try {
      const img = b.mime === "image/png" ? await doc.embedPng(b.bytes) : await doc.embedJpg(b.bytes);
      doc.addPage([img.width, img.height]).drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
    } catch {
      throw new OpError("unreadable_image", `${b.name} couldn't be read as a ${b.mime === "image/png" ? "PNG" : "JPG"} image.`);
    }
  }
  return save(doc, inputs.length === 1 ? `${stem(inputs[0].name)}.pdf` : "images.pdf");
}

/* ------------------------------------------------------------------ */
/* Report rendering (AI results → PDF)                                 */
/* ------------------------------------------------------------------ */

const WINANSI_MAP: Record<string, string> = {
  "‘": "'", "’": "'", "“": '"', "”": '"', "–": "-", "—": "-",
  "…": "...", " ": " ", "•": "-", "→": "->", "≤": "<=", "≥": ">=",
};

function winAnsi(font: PDFFont, s: string) {
  let out = "";
  for (const ch of s.replace(/[‘’“”–—… •→≤≥]/g, (c) => WINANSI_MAP[c] ?? c)) {
    try {
      font.encodeText(ch);
      out += ch;
    } catch {
      out += "?";
    }
  }
  return out;
}

/** Renders a small Markdown subset (#, ##, -, paragraphs, **bold** stripped). */
export async function renderReport(title: string, markdown: string, footer: string): Promise<Blob> {
  const doc = await PDFDocument.create();
  doc.setTitle(title);
  doc.setProducer("peedf");
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const W = 595, H = 842, M = 56, maxW = W - 2 * M;
  let page = doc.addPage([W, H]);
  let y = H - M;

  const newPage = () => {
    page = doc.addPage([W, H]);
    y = H - M;
  };
  const wrap = (text: string, font: PDFFont, size: number, width: number) => {
    const words = winAnsi(font, text).split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let line = "";
    for (const w of words) {
      const t = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(t, size) <= width) line = t;
      else {
        if (line) lines.push(line);
        line = w;
      }
    }
    if (line) lines.push(line);
    return lines;
  };
  const draw = (text: string, font: PDFFont, size: number, indent = 0, gapAfter = 4, color = rgb(0.09, 0.1, 0.12)) => {
    for (const l of wrap(text, font, size, maxW - indent)) {
      if (y - size < M + 20) newPage();
      y -= size * 1.35;
      page.drawText(l, { x: M + indent, y, size, font, color });
    }
    y -= gapAfter;
  };

  draw(title, bold, 20, 0, 10);
  for (const raw of markdown.split("\n")) {
    const line = raw.replace(/\*\*(.+?)\*\*/g, "$1").replace(/`/g, "").trimEnd();
    if (!line.trim()) {
      y -= 4;
      continue;
    }
    if (line.startsWith("## ")) draw(line.slice(3), bold, 13, 0, 4);
    else if (line.startsWith("# ")) draw(line.slice(2), bold, 15, 0, 6);
    else if (/^\s*[-*] /.test(line)) {
      const depth = line.match(/^\s*/)![0].length >= 2 ? 14 : 0;
      if (y - 11 < M + 20) newPage();
      page.drawText("-", { x: M + depth, y: y - 11 * 1.35, size: 11, font: regular });
      draw(line.replace(/^\s*[-*] /, ""), regular, 11, depth + 12, 2);
    } else draw(line, regular, 11, 0, 4);
  }
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    const t = winAnsi(regular, `${footer} · Page ${i + 1} of ${pages.length}`);
    p.drawText(t, { x: M, y: 28, size: 8, font: regular, color: rgb(0.42, 0.45, 0.5) });
  });
  const bytes = await doc.save();
  return { name: "report.pdf", mime: "application/pdf", bytes, pages: pages.length };
}

/* ------------------------------------------------------------------ */
/* Output validation                                                   */
/* ------------------------------------------------------------------ */

/** Re-opens an output and checks it is what we claim it is. */
export async function validateOutput(b: Blob, expect: { pages?: number }) {
  if (b.bytes.byteLength === 0) throw new OpError("empty_output", "The result came out empty.");
  if (b.mime === "application/pdf") {
    const doc = await PDFDocument.load(b.bytes);
    const n = doc.getPageCount();
    if (n < 1) throw new OpError("invalid_output", "The result has no pages.");
    if (expect.pages !== undefined && n !== expect.pages) {
      throw new OpError("invalid_output", `Expected ${expect.pages} pages in the result but found ${n}.`);
    }
    return { pages: n };
  }
  if (b.mime === "application/zip") {
    const zip = await JSZip.loadAsync(b.bytes);
    const n = Object.keys(zip.files).length;
    if (!n) throw new OpError("invalid_output", "The zip came out empty.");
    return { entries: n };
  }
  if (b.mime.startsWith("application/vnd.openxmlformats")) {
    const zip = await JSZip.loadAsync(b.bytes);
    if (!zip.file("xl/worksheets/sheet1.xml")) throw new OpError("invalid_output", "The spreadsheet is incomplete.");
    return {};
  }
  if (b.mime === "image/jpeg") {
    if (!(b.bytes[0] === 0xff && b.bytes[1] === 0xd8)) throw new OpError("invalid_output", "The image is not a valid JPEG.");
    return {};
  }
  return {};
}

/* ------------------------------------------------------------------ */
/* Tables (extraction results → CSV / XLSX)                            */
/* ------------------------------------------------------------------ */

function csvCell(v: string) {
  // Neutralise spreadsheet formula injection from document-derived values.
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

function xmlEscape(s: string) {
  return s
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function colName(i: number) {
  let s = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

export async function renderTable(format: "csv" | "xlsx", columns: string[], rows: string[][], name: string): Promise<Blob> {
  if (format === "csv") {
    const body = [columns, ...rows].map((r) => r.map((c) => csvCell(c ?? "")).join(",")).join("\r\n") + "\r\n";
    return { name: `${name}.csv`, mime: "text/csv; charset=utf-8", bytes: new TextEncoder().encode("﻿" + body), meta: { rows: rows.length } };
  }
  const sheetRows = [columns, ...rows]
    .map(
      (r, ri) =>
        `<row r="${ri + 1}">${r
          .map((c, ci) => {
            const v = c ?? "";
            const ref = `${colName(ci)}${ri + 1}`;
            const style = ri === 0 ? ' s="1"' : "";
            // Values are always written as text: no formulas are ever evaluated from document content.
            return `<c r="${ref}" t="inlineStr"${style}><is><t xml:space="preserve">${xmlEscape(v)}</t></is></c>`;
          })
          .join("")}</row>`
    )
    .join("");
  const widths = columns
    .map((c, i) => {
      const w = Math.min(60, Math.max(10, c.length, ...rows.map((r) => (r[i] ?? "").length)) + 2);
      return `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`;
    })
    .join("");
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`
  );
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`
  );
  zip.file(
    "xl/workbook.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Extracted" sheetId="1" r:id="rId1"/></sheets></workbook>`
  );
  zip.file(
    "xl/_rels/workbook.xml.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`
  );
  zip.file(
    "xl/styles.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs></styleSheet>`
  );
  zip.file(
    "xl/worksheets/sheet1.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${widths}</cols><sheetData>${sheetRows}</sheetData></worksheet>`
  );
  const bytes = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  return {
    name: `${name}.xlsx`,
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    bytes,
    meta: { rows: rows.length },
  };
}
