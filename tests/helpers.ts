import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { createCanvas } from "@napi-rs/canvas";
import { randomBytes } from "node:crypto";
import type { Blob } from "../lib/engine/ops";

/** Builds a text PDF where every page has a heading, an invoice line and a coloured block. */
export async function makePdf(pages: number, name = "sample.pdf", label = "Sample"): Promise<Blob> {
  const doc = await PDFDocument.create();
  const f = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= pages; i++) {
    const p = doc.addPage([595, 842]);
    p.drawText(`${label} page ${i}`, { x: 50, y: 780, size: 22, font: f });
    p.drawText(`Invoice INV-${1000 + i} dated 2026-03-${String(i).padStart(2, "0")}. Total due: R ${i * 1250}.00`, {
      x: 50,
      y: 740,
      size: 12,
      font: f,
    });
    p.drawRectangle({ x: 50, y: 200, width: 450, height: 450, color: rgb((i % 10) / 10, 0.4, 0.7) });
  }
  return { name, mime: "application/pdf", bytes: await doc.save(), pages };
}

/** A "scanned" PDF: one big photo-like image per page and no text layer. */
export async function makeScannedPdf(pages: number): Promise<Blob> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) {
    // Photo-like noise: compresses poorly as PNG, like a real colour scan.
    const c = createCanvas(900, 1200);
    const ctx = c.getContext("2d");
    const px = ctx.createImageData(900, 1200);
    const noise = randomBytes(px.data.length / 4);
    for (let k = 0; k < px.data.length; k += 4) {
      const v = 120 + (noise[k / 4] % 100);
      px.data[k] = v;
      px.data[k + 1] = v - 10;
      px.data[k + 2] = v - 20;
      px.data[k + 3] = 255;
    }
    ctx.putImageData(px, 0, 0);
    const png = await c.encode("png");
    const img = await doc.embedPng(png);
    doc.addPage([595, 842]).drawImage(img, { x: 0, y: 0, width: 595, height: 842 });
  }
  return { name: "scan.pdf", mime: "application/pdf", bytes: await doc.save(), pages };
}

export async function makeJpeg(w = 400, h = 300): Promise<Blob> {
  const c = createCanvas(w, h);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#4f3ff0";
  ctx.fillRect(0, 0, w, h);
  return { name: "photo.jpg", mime: "image/jpeg", bytes: new Uint8Array(await c.encode("jpeg", 85)) };
}

export async function pageCount(bytes: Uint8Array) {
  return (await PDFDocument.load(bytes)).getPageCount();
}

export const SANDBOX = { timeoutMs: 60_000, memoryMb: 512 };
