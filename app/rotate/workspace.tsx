"use client";
import { useState } from "react";
import { Download, Loader2, FileText, RotateCw, RotateCcw } from "lucide-react";
import Dropzone from "@/components/Dropzone";
import StatusMessage from "@/components/StatusMessage";
import { baseName, downloadBlob, isPdf, loadPdfLib, MAX_FILE_SIZE } from "@/lib/pdf-utils";
import { durationBand, pageBand, sizeBand, track } from "@/lib/analytics";

const TOOL = "rotate";

export default function RotateWorkspace() {
  const [file, setFile] = useState<File | null>(null);
  const [angle, setAngle] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

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
    setAngle(0);
    track("file_added", { tool: TOOL, file_count: 1, size_band: sizeBand(f.size) });
  }

  function turn(delta: number) {
    setAngle((a) => (((a + delta) % 360) + 360) % 360);
  }

  async function apply() {
    if (!file) return;
    if (angle === 0) {
      setError("Rotate the page before downloading, or it'll be unchanged.");
      return;
    }
    setBusy(true);
    setError("");
    const started = performance.now();
    track("tool_run", { tool: TOOL, option: String(angle) });
    try {
      const { PDFDocument, degrees } = await loadPdfLib();
      const doc = await PDFDocument.load(await file.arrayBuffer());
      const pages = doc.getPages();
      for (const page of pages) {
        const current = page.getRotation().angle;
        page.setRotation(degrees((current + angle) % 360));
      }
      const blob = new Blob([(await doc.save()) as BlobPart], { type: "application/pdf" });
      downloadBlob(blob, `${baseName(file)}-rotated.pdf`);
      track("tool_complete", {
        tool: TOOL,
        option: String(angle),
        output: "pdf",
        page_band: pageBand(pages.length),
        duration_band: durationBand(performance.now() - started),
      });
    } catch {
      setError("Couldn't rotate that PDF. It may be corrupted or password-protected.");
      track("tool_error", { tool: TOOL, reason: "unreadable" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="text-center">
        <h1 className="font-display text-4xl font-extrabold sm:text-5xl">Rotate PDF</h1>
        <p className="mt-3 text-[var(--muted)]">Rotate every page in a PDF, all at once.</p>
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

          <div className="mt-6 flex flex-col items-center">
            <div
              aria-hidden="true"
              className="flex h-32 w-24 items-center justify-center rounded-lg border-2 border-[var(--fg)] bg-white text-xs text-[var(--muted)] transition-transform duration-300"
              style={{ transform: `rotate(${angle}deg)` }}
            >
              Page
            </div>
            <div className="mt-5 flex gap-3">
              <button type="button" onClick={() => turn(-90)} disabled={busy} className="btn btn-outline px-4 py-2.5 text-sm">
                <RotateCcw size={16} aria-hidden="true" />
                Left 90°
              </button>
              <button type="button" onClick={() => turn(90)} disabled={busy} className="btn btn-outline px-4 py-2.5 text-sm">
                <RotateCw size={16} aria-hidden="true" />
                Right 90°
              </button>
            </div>
            <p className="mt-3 text-xs text-[var(--muted)]" aria-live="polite">
              Current: {angle}°
            </p>
          </div>

          <button
            type="button"
            disabled={busy}
            aria-busy={busy}
            onClick={apply}
            className="mt-6 w-full btn btn-primary px-5 py-3.5 disabled:opacity-40"
          >
            {busy ? (
              <>
                <Loader2 className="mx-auto animate-spin" aria-hidden="true" />
                <span className="sr-only">Rotating…</span>
              </>
            ) : (
              <>
                <Download className="mr-2 inline" size={17} aria-hidden="true" />
                Rotate & download
              </>
            )}
          </button>
        </div>
      )}

      <StatusMessage>{error}</StatusMessage>
    </section>
  );
}
