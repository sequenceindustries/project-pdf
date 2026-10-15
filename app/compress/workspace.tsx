"use client";
import { useState } from "react";
import { Download, Loader2, FileText, Minimize2 } from "lucide-react";
import Dropzone from "@/components/Dropzone";
import StatusMessage from "@/components/StatusMessage";
import { baseName, downloadBlob, isPdf, loadPdfjs, loadPdfLib, MAX_FILE_SIZE } from "@/lib/pdf-utils";
import { durationBand, pageBand, sizeBand, track } from "@/lib/analytics";

const TOOL = "compress";

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
  const { PDFDocument } = await loadPdfLib();
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
  onProgress: (msg: string) => void,
  onPages: (n: number) => void
): Promise<Uint8Array> {
  const [pdfjsLib, { PDFDocument }] = await Promise.all([loadPdfjs(), loadPdfLib()]);

  const data = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  onPages(pdf.numPages);
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
    canvas.width = 0;
    canvas.height = 0;
  }

  return out.save();
}

type Result = { blob: Blob; size: number; method: "raster" | "structural" } | { blob: null; size: number; method: "none" };

export default function CompressWorkspace() {
  const [file, setFile] = useState<File | null>(null);
  const [levelIndex, setLevelIndex] = useState(1);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);

  function handleFiles(files: File[]) {
    setError("");
    setResult(null);
    const f = files[0];
    if (!f) return;
    if (!isPdf(f)) {
      setError("Please choose a PDF file.");
      track("file_rejected", { tool: TOOL, reason: "type" });
      return;
    }
    if (f.size > MAX_FILE_SIZE) {
      setError("File is larger than the 50 MB limit.");
      track("file_rejected", { tool: TOOL, reason: "size" });
      return;
    }
    setFile(f);
    track("file_added", { tool: TOOL, file_count: 1, size_band: sizeBand(f.size) });
  }

  async function compress() {
    if (!file) return;
    setBusy(true);
    setError("");
    setResult(null);
    const level = LEVELS[levelIndex];
    const started = performance.now();
    let pages = 0;
    track("tool_run", { tool: TOOL, option: level.label.toLowerCase() });
    try {
      setProgress("Analyzing PDF…");

      const [structuralBytes, rasterBytes] = await Promise.all([
        structuralCompress(await file.arrayBuffer()).catch(() => null),
        rasterCompress(file, level, setProgress, (n) => (pages = n)).catch(() => null),
      ]);

      const candidates: { bytes: Uint8Array; method: "raster" | "structural" }[] = [];
      if (structuralBytes) candidates.push({ bytes: structuralBytes, method: "structural" });
      if (rasterBytes) candidates.push({ bytes: rasterBytes, method: "raster" });

      if (candidates.length === 0) {
        setError("Couldn't compress that PDF. It may be corrupted or password-protected.");
        track("tool_error", { tool: TOOL, reason: "unreadable" });
        return;
      }

      const best = candidates.reduce((a, b) => (a.bytes.length <= b.bytes.length ? a : b));
      if (best.bytes.length >= file.size) {
        // Never hand back a file that's bigger than the original.
        setResult({ blob: null, size: file.size, method: "none" });
        track("tool_complete", {
          tool: TOOL,
          option: level.label.toLowerCase(),
          result: "no_saving",
          page_band: pageBand(pages),
          duration_band: durationBand(performance.now() - started),
        });
        return;
      }
      const blob = new Blob([best.bytes as BlobPart], { type: "application/pdf" });
      setResult({ blob, size: blob.size, method: best.method });
      track("tool_complete", {
        tool: TOOL,
        option: level.label.toLowerCase(),
        result: best.method,
        output: "pdf",
        page_band: pageBand(pages),
        duration_band: durationBand(performance.now() - started),
      });
    } catch {
      setError("Couldn't compress that PDF. It may be corrupted or password-protected.");
      track("tool_error", { tool: TOOL });
    } finally {
      setBusy(false);
      setProgress("");
    }
  }

  function download() {
    if (!file || !result?.blob) return;
    downloadBlob(result.blob, `${baseName(file)}-compressed.pdf`);
  }

  const savedPct =
    file && result && file.size > 0 ? Math.max(0, Math.round((1 - result.size / file.size) * 100)) : null;

  return (
    <section className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="text-center">
        <h1 className="font-display text-4xl font-extrabold sm:text-5xl">Compress PDF</h1>
        <p className="mt-3 text-[var(--muted)]">
          Shrink file size by recompressing pages, entirely in your browser.
        </p>
      </div>

      {!file && (
        <Dropzone accept="application/pdf,.pdf" onFiles={handleFiles} title="Drop a PDF here" subtitle="or click to browse" />
      )}

      {file && (
        <div className="mt-6 card-chunky bg-[var(--surface-soft)] p-5 sm:p-6">
          <div className="flex items-center gap-3 border-b border-[var(--border)] pb-4">
            <FileText size={20} className="shrink-0 text-[var(--muted)]" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{file.name}</div>
              <div className="text-xs text-[var(--muted)]">{formatSize(file.size)}</div>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setFile(null);
                setResult(null);
                setError("");
              }}
              className="shrink-0 text-sm text-[var(--muted)] underline disabled:opacity-40"
            >
              Change file
            </button>
          </div>

          {!result ? (
            <>
              <fieldset className="mt-5">
                <legend className="block text-sm font-medium">Compression level</legend>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {LEVELS.map((l, i) => (
                    <button
                      type="button"
                      key={l.label}
                      aria-pressed={levelIndex === i}
                      disabled={busy}
                      onClick={() => setLevelIndex(i)}
                      className={`rounded-[0.9rem] border-2 px-2 py-2.5 text-sm font-bold transition-colors ${
                        levelIndex === i
                          ? "border-[var(--accent-dark)] bg-[var(--accent)] text-white"
                          : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent)]/50"
                      }`}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              </fieldset>
              <p className="mt-2 text-xs text-[var(--muted)]">{LEVELS[levelIndex].hint}</p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Stronger levels redraw each page as an image, so text stops being selectable —
                we automatically keep whichever result comes out smaller.
              </p>

              <button
                type="button"
                disabled={busy}
                aria-busy={busy}
                onClick={compress}
                className="mt-5 w-full btn btn-primary px-5 py-3.5 disabled:opacity-40"
              >
                {busy ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="animate-spin" size={17} aria-hidden="true" />
                    {progress || "Compressing…"}
                  </span>
                ) : (
                  <>
                    <Minimize2 className="mr-2 inline" size={17} aria-hidden="true" />
                    Compress PDF
                  </>
                )}
              </button>
            </>
          ) : (
            <div className="mt-5" role="status">
              {result.method === "none" ? (
                <p className="rounded-xl bg-[var(--surface)] px-4 py-3 text-sm">
                  This PDF is already about as small as it can get — neither method beat the
                  original {formatSize(file.size)}, so there&apos;s nothing to download. Try a
                  stronger level, or keep your original.
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[var(--surface)] px-4 py-3 text-sm">
                    <span className="text-[var(--muted)]">{formatSize(file.size)}</span>
                    <span className="font-semibold">→ {formatSize(result.size)}</span>
                    {savedPct !== null && savedPct > 0 && (
                      <span className="rounded-full bg-[var(--success-bg)] px-2.5 py-1 text-xs font-semibold text-[var(--success)]">
                        -{savedPct}%
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-[var(--muted)]">
                    {result.method === "raster"
                      ? "Pages were redrawn as compressed images — text in this copy is no longer selectable."
                      : "Reduced by optimizing PDF structure; page content is unchanged."}
                  </p>
                  <button type="button" onClick={download} className="mt-4 w-full btn btn-primary px-5 py-3.5">
                    <Download className="mr-2 inline" size={17} aria-hidden="true" />
                    Download compressed PDF
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => setResult(null)}
                className="mt-2 w-full btn btn-outline px-5 py-3 text-sm text-[var(--muted)]"
              >
                Try a different level
              </button>
            </div>
          )}
        </div>
      )}

      <StatusMessage>{error}</StatusMessage>
    </section>
  );
}
