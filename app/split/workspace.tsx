"use client";
import { useState } from "react";
import { Download, Loader2, FileText } from "lucide-react";
import Dropzone from "@/components/Dropzone";
import StatusMessage from "@/components/StatusMessage";
import { baseName, downloadBlob, isPdf, loadPdfLib, MAX_FILE_SIZE } from "@/lib/pdf-utils";
import { durationBand, pageBand, sizeBand, track } from "@/lib/analytics";

const TOOL = "split";

function parseRanges(input: string, pageCount: number): number[] | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const indices = new Set<number>();
  const parts = trimmed.split(",");
  for (const part of parts) {
    const p = part.trim();
    if (!p) continue;
    const rangeMatch = p.match(/^(\d+)\s*[-–]\s*(\d+)$/);
    if (rangeMatch) {
      let start = parseInt(rangeMatch[1], 10);
      let end = parseInt(rangeMatch[2], 10);
      if (start > end) [start, end] = [end, start];
      if (start < 1 || end > pageCount) return null;
      for (let i = start; i <= end; i++) indices.add(i - 1);
    } else if (/^\d+$/.test(p)) {
      const n = parseInt(p, 10);
      if (n < 1 || n > pageCount) return null;
      indices.add(n - 1);
    } else {
      return null;
    }
  }
  return indices.size ? Array.from(indices).sort((a, b) => a - b) : null;
}

export default function SplitWorkspace() {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [ranges, setRanges] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loadingCount, setLoadingCount] = useState(false);

  async function handleFiles(files: File[]) {
    setError("");
    setFile(null);
    setPageCount(null);
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
    setLoadingCount(true);
    try {
      const { PDFDocument } = await loadPdfLib();
      const doc = await PDFDocument.load(await f.arrayBuffer());
      setFile(f);
      setPageCount(doc.getPageCount());
      track("file_added", { tool: TOOL, file_count: 1, size_band: sizeBand(f.size), page_band: pageBand(doc.getPageCount()) });
    } catch {
      setError("Couldn't read that PDF. It may be corrupted or password-protected.");
      track("file_rejected", { tool: TOOL, reason: "unreadable" });
    } finally {
      setLoadingCount(false);
    }
  }

  async function split() {
    if (!file || !pageCount) return;
    const indices = parseRanges(ranges, pageCount);
    if (!indices) {
      setError(`Enter valid pages or ranges between 1 and ${pageCount}, e.g. "1-3,5".`);
      track("tool_error", { tool: TOOL, reason: "input" });
      return;
    }
    setBusy(true);
    setError("");
    const started = performance.now();
    track("tool_run", { tool: TOOL });
    try {
      const { PDFDocument } = await loadPdfLib();
      const src = await PDFDocument.load(await file.arrayBuffer());
      const out = await PDFDocument.create();
      const pages = await out.copyPages(src, indices);
      pages.forEach((p) => out.addPage(p));
      const blob = new Blob([(await out.save()) as BlobPart], { type: "application/pdf" });
      downloadBlob(blob, `${baseName(file)}-split.pdf`);
      track("tool_complete", {
        tool: TOOL,
        output: "pdf",
        page_band: pageBand(indices.length),
        duration_band: durationBand(performance.now() - started),
      });
    } catch {
      setError("Couldn't split that PDF. Please try again.");
      track("tool_error", { tool: TOOL });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="text-center">
        <h1 className="font-display text-4xl font-extrabold sm:text-5xl">Split PDF</h1>
        <p className="mt-3 text-[var(--muted)]">Extract specific pages or ranges into a new PDF.</p>
      </div>

      {!file && (
        <Dropzone
          accept="application/pdf,.pdf"
          onFiles={handleFiles}
          disabled={loadingCount}
          title={loadingCount ? "Reading PDF…" : "Drop a PDF here"}
          subtitle="or click to browse"
        />
      )}

      {file && pageCount && (
        <div className="mt-6 card-chunky bg-[var(--surface-soft)] p-5 sm:p-6">
          <div className="flex items-center gap-3 border-b border-[var(--border)] pb-4">
            <FileText size={20} className="shrink-0 text-[var(--muted)]" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{file.name}</div>
              <div className="text-xs text-[var(--muted)]">
                {pageCount} page{pageCount === 1 ? "" : "s"}
              </div>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setFile(null);
                setPageCount(null);
                setRanges("");
                setError("");
              }}
              className="shrink-0 text-sm text-[var(--muted)] underline disabled:opacity-40"
            >
              Change file
            </button>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              split();
            }}
          >
            <label htmlFor="split-ranges" className="mt-4 block text-sm font-medium">
              Pages to extract
            </label>
            <input
              id="split-ranges"
              value={ranges}
              onChange={(e) => setRanges(e.target.value)}
              placeholder={`e.g. 1-3,5,8-${pageCount}`}
              inputMode="numeric"
              autoComplete="off"
              aria-describedby="split-ranges-help"
              className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-base outline-none focus:border-[var(--accent)] sm:text-sm"
            />
            <p id="split-ranges-help" className="mt-2 text-xs text-[var(--muted)]">
              Use commas for individual pages and dashes for ranges. Pages 1–{pageCount}.
            </p>

            <button
              type="submit"
              disabled={busy}
              aria-busy={busy}
              className="mt-5 w-full btn btn-primary px-5 py-3.5 disabled:opacity-40"
            >
              {busy ? (
                <>
                  <Loader2 className="mx-auto animate-spin" aria-hidden="true" />
                  <span className="sr-only">Splitting…</span>
                </>
              ) : (
                <>
                  <Download className="mr-2 inline" size={17} aria-hidden="true" />
                  Split & download
                </>
              )}
            </button>
          </form>
        </div>
      )}

      <StatusMessage>{error}</StatusMessage>
    </section>
  );
}
