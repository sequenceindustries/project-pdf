"use client";
import { useState } from "react";
import { PDFDocument } from "pdf-lib";
import { Download, Loader2, FileText, Minimize2 } from "lucide-react";
import Header from "@/components/Header";
import Dropzone from "@/components/Dropzone";
import StatusMessage from "@/components/StatusMessage";
import { isPdf, MAX_FILE_SIZE } from "@/lib/pdf-utils";

const PDFJS_VERSION = "4.10.38";

const LEVELS = [
  { label: "Light", scale: 1.6, quality: 0.85, hint: "Best quality, smaller savings" },
  { label: "Recommended", scale: 1.3, quality: 0.72, hint: "Good balance for most files" },
  { label: "Strong", scale: 1.0, quality: 0.5, hint: "Smallest file, lower image quality" },
] as const;

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function structuralCompress(bytes: ArrayBuffer): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  doc.setTitle("");
  doc.setSubject("");
  doc.setKeywords([]);
  doc.setProducer("");
  doc.setCreator("");
  return doc.save({ useObjectStreams: true, addDefaultPage: false });
}

async function rasterCompress(
  file: File,
  level: (typeof LEVELS)[number],
  onProgress: (msg: string) => void
): Promise<Uint8Array> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.mjs`;

  const data = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const out = await PDFDocument.create();

  for (let i = 1; i <= pdf.numPages; i++) {
    onProgress(`Recompressing page ${i} of ${pdf.numPages}…`);
    const page = await pdf.getPage(i);
    const pointViewport = page.getViewport({ scale: 1 });
    const renderViewport = page.getViewport({ scale: level.scale });

    const canvas = document.createElement("canvas");
    canvas.width = renderViewport.width;
    canvas.height = renderViewport.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas unsupported");
    await page.render({ canvasContext: ctx, viewport: renderViewport }).promise;

    const jpegBlob: Blob = await new Promise((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/jpeg", level.quality)
    );
    const jpegBytes = new Uint8Array(await jpegBlob.arrayBuffer());
    const image = await out.embedJpg(jpegBytes);
    const outPage = out.addPage([pointViewport.width, pointViewport.height]);
    outPage.drawImage(image, {
      x: 0,
      y: 0,
      width: pointViewport.width,
      height: pointViewport.height,
    });
  }

  return out.save();
}

export default function CompressWorkspace() {
  const [file, setFile] = useState<File | null>(null);
  const [levelIndex, setLevelIndex] = useState(1);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ blob: Blob; size: number; method: "raster" | "structural" } | null>(
    null
  );

  function handleFiles(files: File[]) {
    setError("");
    setResult(null);
    const f = files[0];
    if (!f) return;
    if (!isPdf(f)) {
      setError("Please choose a PDF file.");
      return;
    }
    if (f.size > MAX_FILE_SIZE) {
      setError("File is larger than the 50 MB limit.");
      return;
    }
    setFile(f);
  }

  async function compress() {
    if (!file) return;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const level = LEVELS[levelIndex];
      setProgress("Analyzing PDF…");

      const [structuralBytes, rasterBytes] = await Promise.all([
        structuralCompress(await file.arrayBuffer()).catch(() => null),
        rasterCompress(file, level, setProgress).catch(() => null),
      ]);

      const candidates: { bytes: Uint8Array; method: "raster" | "structural" }[] = [];
      if (structuralBytes) candidates.push({ bytes: structuralBytes, method: "structural" });
      if (rasterBytes) candidates.push({ bytes: rasterBytes, method: "raster" });

      if (candidates.length === 0) {
        setError("Couldn't compress that PDF. It may be corrupted or password-protected.");
        return;
      }

      const best = candidates.reduce((a, b) => (a.bytes.length <= b.bytes.length ? a : b));
      const blob = new Blob([best.bytes as BlobPart], { type: "application/pdf" });
      setResult({ blob, size: blob.size, method: best.method });
    } catch {
      setError("Couldn't compress that PDF. It may be corrupted or password-protected.");
    } finally {
      setBusy(false);
      setProgress("");
    }
  }

  function download() {
    if (!file || !result) return;
    const url = URL.createObjectURL(result.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name.replace(/\.pdf$/i, "") + "-compressed.pdf";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const savedPct =
    file && result && file.size > 0
      ? Math.max(0, Math.round((1 - result.size / file.size) * 100))
      : null;

  return (
    <main className="min-h-screen">
      <Header />
      <section className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="text-center">
          <h1 className="font-display text-3xl font-bold sm:text-4xl">Compress PDF</h1>
          <p className="mt-3 text-[var(--muted)]">
            Shrink file size by recompressing pages, entirely in your browser.
          </p>
        </div>

        {!file && (
          <Dropzone
            accept="application/pdf,.pdf"
            onFiles={handleFiles}
            title="Drop a PDF here"
            subtitle="or click to browse"
          />
        )}

        {file && (
          <div className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
            <div className="flex items-center gap-3 border-b border-[var(--border)] pb-4">
              <FileText size={20} className="shrink-0 text-[var(--muted)]" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{file.name}</div>
                <div className="text-xs text-[var(--muted)]">{formatSize(file.size)}</div>
              </div>
              <button
                onClick={() => {
                  setFile(null);
                  setResult(null);
                  setError("");
                }}
                className="shrink-0 text-sm text-[var(--muted)] underline"
              >
                Change file
              </button>
            </div>

            {!result ? (
              <>
                <label className="mt-5 block text-sm font-medium">Compression level</label>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {LEVELS.map((l, i) => (
                    <button
                      key={l.label}
                      onClick={() => setLevelIndex(i)}
                      className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
                        levelIndex === i
                          ? "border-[var(--fg)] bg-[var(--fg)] text-white"
                          : "border-[var(--border)] hover:border-[var(--fg)]/40"
                      }`}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-[var(--muted)]">{LEVELS[levelIndex].hint}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  Stronger levels redraw each page as an image, so text stops being selectable —
                  we automatically keep whichever result comes out smaller.
                </p>

                <button
                  disabled={busy}
                  onClick={compress}
                  className="mt-5 w-full rounded-xl bg-black px-5 py-3.5 font-semibold text-white transition-opacity disabled:opacity-40"
                >
                  {busy ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="animate-spin" size={17} />
                      {progress || "Compressing…"}
                    </span>
                  ) : (
                    <>
                      <Minimize2 className="mr-2 inline" size={17} />
                      Compress PDF
                    </>
                  )}
                </button>
              </>
            ) : (
              <div className="mt-5">
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-gray-50 px-4 py-3 text-sm">
                  <span className="text-[var(--muted)]">{formatSize(file.size)}</span>
                  <span className="font-semibold">→ {formatSize(result.size)}</span>
                  {savedPct !== null && savedPct > 0 && (
                    <span className="rounded-full bg-[var(--success-bg)] px-2.5 py-1 text-xs font-semibold text-[var(--success)]">
                      -{savedPct}%
                    </span>
                  )}
                </div>
                {savedPct === 0 ? (
                  <p className="mt-2 text-xs text-[var(--muted)]">
                    This PDF was already about as small as it can get — even a full page
                    recompression didn&apos;t beat the original.
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-[var(--muted)]">
                    {result.method === "raster"
                      ? "Pages were redrawn as compressed images — text in this PDF is no longer selectable."
                      : "Reduced by optimizing PDF structure; page content is unchanged."}
                  </p>
                )}
                <button
                  onClick={download}
                  className="mt-4 w-full rounded-xl bg-black px-5 py-3.5 font-semibold text-white"
                >
                  <Download className="mr-2 inline" size={17} />
                  Download compressed PDF
                </button>
                <button
                  onClick={() => setResult(null)}
                  className="mt-2 w-full rounded-xl border border-[var(--border)] px-5 py-3 text-sm font-medium text-[var(--muted)] hover:border-[var(--fg)]/40"
                >
                  Try a different level
                </button>
              </div>
            )}
          </div>
        )}

        <StatusMessage>{error}</StatusMessage>
      </section>
    </main>
  );
}
