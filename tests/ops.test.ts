import { test } from "node:test";
import assert from "node:assert/strict";
import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";
import { runInSandbox } from "../lib/engine/sandbox";
import type { Blob, Inspection } from "../lib/engine/ops";
import { parsePageOrder, parsePageSpec } from "../lib/engine/pages";
import { makeJpeg, makePdf, makeScannedPdf, pageCount, SANDBOX } from "./helpers";

test("page specs", () => {
  assert.deepEqual(parsePageSpec("5-8", 10), { ok: true, indices: [4, 5, 6, 7] });
  assert.deepEqual(parsePageSpec("1, 3 and 9-last", 10), { ok: true, indices: [0, 2, 8, 9] });
  assert.deepEqual(parsePageSpec("8–5", 10), { ok: true, indices: [4, 5, 6, 7] });
  assert.equal(parsePageSpec("5-12", 10).ok, false);
  assert.equal(parsePageSpec("0", 10).ok, false);
  assert.equal(parsePageSpec("abc", 10).ok, false);
  assert.deepEqual(parsePageOrder("3,1,2", 3), { ok: true, indices: [2, 0, 1] });
  assert.deepEqual(parsePageOrder("reverse", 3), { ok: true, indices: [2, 1, 0] });
  assert.equal(parsePageOrder("1,2", 3).ok, false, "must list every page");
  assert.equal(parsePageOrder("1,1,2", 3).ok, false, "no duplicates");
});

test("inspect: text pdf, scanned pdf, image, garbage", async () => {
  const text = await runInSandbox<Inspection>("inspect", [await makePdf(3)], {}, SANDBOX);
  assert.equal(text.pages, 3);
  assert.equal(text.scanned, false);
  const scan = await runInSandbox<Inspection>("inspect", [await makeScannedPdf(2)], {}, SANDBOX);
  assert.equal(scan.scanned, true);
  const img = await runInSandbox<Inspection>("inspect", [await makeJpeg()], {}, SANDBOX);
  assert.equal(img.kind, "image");
  await assert.rejects(
    runInSandbox("inspect", [{ name: "x.pdf", mime: "application/pdf", bytes: new TextEncoder().encode("%PDF-1.7 garbage") }], {}, SANDBOX),
    (e: { code: string }) => e.code === "unreadable_pdf"
  );
});

test("merge, extract, remove, reorder, rotate", async () => {
  const a = await makePdf(3, "a.pdf", "A");
  const b = await makePdf(2, "b.pdf", "B");
  const merged = await runInSandbox<Blob>("merge", [a, b], {}, SANDBOX);
  assert.equal(await pageCount(merged.bytes), 5);

  const ten = await makePdf(10);
  const removed = await runInSandbox<Blob>("remove_pages", [ten], { pages: "5-8" }, SANDBOX);
  assert.equal(await pageCount(removed.bytes), 6);
  const texts = await runInSandbox<string[]>("text_pages", [removed], {}, SANDBOX);
  assert.match(texts[4], /page 9/, "page after the removed range is now 5th");

  const extracted = await runInSandbox<Blob>("extract_pages", [ten], { pages: "2,4" }, SANDBOX);
  assert.equal(await pageCount(extracted.bytes), 2);

  const reordered = await runInSandbox<Blob>("reorder_pages", [a], { order: "3,1,2" }, SANDBOX);
  const order = await runInSandbox<string[]>("text_pages", [reordered], {}, SANDBOX);
  assert.match(order[0], /A page 3/);

  const rotated = await runInSandbox<Blob>("rotate", [a], { angle: 90, pages: "2" }, SANDBOX);
  const rdoc = await PDFDocument.load(rotated.bytes);
  assert.deepEqual(rdoc.getPages().map((p) => p.getRotation().angle), [0, 90, 0]);

  await assert.rejects(runInSandbox("remove_pages", [a], { pages: "1-3" }, SANDBOX), (e: { code: string }) => e.code === "bad_pages");
  await assert.rejects(runInSandbox("extract_pages", [a], { pages: "7" }, SANDBOX), (e: { code: string }) => e.code === "bad_pages");
});

test("compress never grows a file and raster beats structural on image-heavy pdf", async () => {
  const scan = await makeScannedPdf(3);
  const out = await runInSandbox<Blob>("compress", [scan], { level: "strong" }, SANDBOX);
  assert.ok(out.bytes.byteLength < scan.bytes.byteLength, "smaller");
  assert.equal(out.meta?.method, "raster");
  assert.equal(await pageCount(out.bytes), 3);
});

test("pdf to images, images to pdf, extract text, report, validate", async () => {
  const pdf = await makePdf(3);
  const zip = await runInSandbox<Blob>("pdf_to_images", [pdf], {}, SANDBOX);
  assert.equal(zip.mime, "application/zip");
  assert.equal(Object.keys((await JSZip.loadAsync(zip.bytes)).files).length, 3);
  const one = await runInSandbox<Blob>("pdf_to_images", [pdf], { pages: "2" }, SANDBOX);
  assert.equal(one.mime, "image/jpeg");

  const imgPdf = await runInSandbox<Blob>("images_to_pdf", [await makeJpeg(), await makeJpeg(200, 500)], {}, SANDBOX);
  assert.equal(await pageCount(imgPdf.bytes), 2);

  const txt = await runInSandbox<Blob>("extract_text", [pdf], {}, SANDBOX);
  const s = new TextDecoder().decode(txt.bytes);
  assert.match(s, /--- Page 2 ---\nSample page 2/);
  assert.match(s, /INV-1003/);

  const report = await runInSandbox<Blob>(
    "render_report",
    [],
    { title: "Summary — test", markdown: "# Heading\n\nA paragraph with “quotes” and emoji 🎉.\n\n- point one\n- point two", footer: "peedf" },
    SANDBOX
  );
  assert.ok((await pageCount(report.bytes)) >= 1);
  await runInSandbox("validate", [report], { expect: {} }, SANDBOX);
  await assert.rejects(runInSandbox("validate", [pdf], { expect: { pages: 9 } }, SANDBOX));
});

test("sandbox enforces timeout", async () => {
  const big = await makeScannedPdf(4);
  await assert.rejects(
    runInSandbox("compress", [big], { level: "light" }, { timeoutMs: 50, memoryMb: 512 }),
    (e: { code: string }) => e.code === "timeout"
  );
});
