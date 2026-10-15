"use client";
import { useState } from "react";
import { Loader2, Trash2, Combine } from "lucide-react";
import Dropzone from "@/components/Dropzone";
import StatusMessage from "@/components/StatusMessage";
import { downloadBlob, isPdf, loadPdfLib, MAX_FILE_SIZE } from "@/lib/pdf-utils";
import { durationBand, pageBand, sizeBand, track } from "@/lib/analytics";

const TOOL = "merge";

type Item = { id: number; file: File };
let nextId = 1;

export default function MergeWorkspace() {
  const [files, setFiles] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function add(fs: File[]) {
    const ok = fs.filter((f) => isPdf(f) && f.size <= MAX_FILE_SIZE);
    if (ok.length) {
      setFiles((x) => [...x, ...ok.map((file) => ({ id: nextId++, file }))]);
      track("file_added", {
        tool: TOOL,
        file_count: ok.length,
        size_band: sizeBand(ok.reduce((n, f) => n + f.size, 0)),
      });
    }
    if (ok.length !== fs.length) {
      setError("Only PDF files up to 50 MB each are accepted.");
      track("file_rejected", { tool: TOOL, reason: fs.some((f) => !isPdf(f)) ? "type" : "size" });
    } else setError("");
  }

  async function merge() {
    if (files.length < 2) {
      setError("Add at least two PDFs.");
      return;
    }
    setBusy(true);
    setError("");
    const started = performance.now();
    track("tool_run", { tool: TOOL, file_count: files.length });
    try {
      const { PDFDocument } = await loadPdfLib();
      const out = await PDFDocument.create();
      for (const { file } of files) {
        const src = await PDFDocument.load(await file.arrayBuffer());
        const pages = await out.copyPages(src, src.getPageIndices());
        pages.forEach((p) => out.addPage(p));
      }
      const blob = new Blob([(await out.save()) as BlobPart], { type: "application/pdf" });
      downloadBlob(blob, "merged.pdf");
      track("tool_complete", {
        tool: TOOL,
        file_count: files.length,
        output: "pdf",
        page_band: pageBand(out.getPageCount()),
        duration_band: durationBand(performance.now() - started),
      });
    } catch {
      setError("Could not process one of the PDFs. It may be corrupted or password-protected.");
      track("tool_error", { tool: TOOL, reason: "unreadable" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="text-center">
        <h1 className="font-display text-4xl font-extrabold sm:text-5xl">Merge PDF</h1>
        <p className="mt-3 text-[var(--muted)]">Combine multiple PDF files into one document.</p>
      </div>

      <Dropzone
        accept="application/pdf,.pdf"
        multiple
        disabled={busy}
        onFiles={add}
        title="Drop PDFs here"
        subtitle="or click to browse"
      />

      {files.length > 0 && (
        <div className="mt-6 card-chunky bg-[var(--surface-soft)] p-4">
          <ol aria-label="Files to merge, in order">
            {files.map(({ id, file }, i) => (
              <li key={id} className="flex items-center gap-3 border-b border-[var(--border)] p-3 last:border-0">
                <span className="min-w-0 flex-1 truncate text-sm">
                  {i + 1}. {file.name}
                </span>
                <button
                  type="button"
                  onClick={() => setFiles((x) => x.filter((it) => it.id !== id))}
                  disabled={busy}
                  className="shrink-0 rounded-md p-1 disabled:opacity-30"
                  aria-label={`Remove ${file.name}`}
                >
                  <Trash2 size={17} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ol>
          <button
            type="button"
            disabled={busy}
            aria-busy={busy}
            onClick={merge}
            className="mt-4 w-full btn btn-primary px-5 py-3.5 disabled:opacity-40"
          >
            {busy ? (
              <>
                <Loader2 className="mx-auto animate-spin" aria-hidden="true" />
                <span className="sr-only">Merging…</span>
              </>
            ) : (
              <>
                <Combine className="mr-2 inline" size={17} aria-hidden="true" />
                Merge & download
              </>
            )}
          </button>
        </div>
      )}

      <StatusMessage>{error}</StatusMessage>
    </section>
  );
}
