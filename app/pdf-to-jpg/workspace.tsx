"use client";
import { useState } from "react";
import { Loader2, FileText, ImageDown } from "lucide-react";
import Dropzone from "@/components/Dropzone";
import StatusMessage from "@/components/StatusMessage";
import { baseName, downloadBlob, isPdf, loadPdfjs, MAX_FILE_SIZE } from "@/lib/pdf-utils";
import { durationBand, pageBand, sizeBand, track } from "@/lib/analytics";

const TOOL = "pdf-to-jpg";

export default function PdfToJpgWorkspace() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");

  function handleFiles(files: File[]) {
    setError("");
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

  async function convert() {
    if (!file) return;
    setBusy(true);
    setError("");
    setProgress("Loading PDF…");
    const started = performance.now();
    track("tool_run", { tool: TOOL });
    try {
      const pdfjsLib = await loadPdfjs();
      const data = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data }).promise;
      const name = baseName(file);
      const jpegBlobs: Blob[] = [];

      for (let i = 1; i <= pdf.numPages; i++) {
        setProgress(`Rendering page ${i} of ${pdf.numPages}…`);
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("canvas unsupported");
        await page.render({ canvasContext: ctx, viewport }).promise;
        const blob: Blob = await new Promise((resolve, reject) =>
          canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/jpeg", 0.92)
        );
        jpegBlobs.push(blob);
        canvas.width = 0;
        canvas.height = 0;
      }

      if (jpegBlobs.length === 1) {
        downloadBlob(jpegBlobs[0], `${name}.jpg`);
      } else {
        setProgress("Packaging pages into a zip…");
        const JSZip = (await import("jszip")).default;
        const zip = new JSZip();
        jpegBlobs.forEach((blob, i) => {
          zip.file(`${name}-page-${i + 1}.jpg`, blob);
        });
        const zipBlob = await zip.generateAsync({ type: "blob" });
        downloadBlob(zipBlob, `${name}-pages.zip`);
      }
      track("tool_complete", {
        tool: TOOL,
        output: jpegBlobs.length === 1 ? "jpg" : "zip",
        page_band: pageBand(jpegBlobs.length),
        duration_band: durationBand(performance.now() - started),
      });
    } catch {
      setError("Couldn't convert that PDF. It may be corrupted or password-protected.");
      track("tool_error", { tool: TOOL, reason: "unreadable" });
    } finally {
      setBusy(false);
      setProgress("");
    }
  }

  return (
    <section className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="text-center">
        <h1 className="font-display text-4xl font-extrabold sm:text-5xl">PDF to JPG</h1>
        <p className="mt-3 text-[var(--muted)]">
          Turn each page into a JPG image. Multi-page PDFs download as a zip.
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
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setFile(null);
                setError("");
              }}
              className="shrink-0 text-sm text-[var(--muted)] underline disabled:opacity-40"
            >
              Change file
            </button>
          </div>

          <button
            type="button"
            disabled={busy}
            aria-busy={busy}
            onClick={convert}
            className="mt-5 w-full btn btn-primary px-5 py-3.5 disabled:opacity-40"
          >
            {busy ? (
              <span className="flex items-center justify-center gap-2" aria-live="polite">
                <Loader2 className="animate-spin" size={17} aria-hidden="true" />
                {progress || "Converting…"}
              </span>
            ) : (
              <>
                <ImageDown className="mr-2 inline" size={17} aria-hidden="true" />
                Convert & download
              </>
            )}
          </button>
        </div>
      )}

      <StatusMessage>{error}</StatusMessage>
    </section>
  );
}
