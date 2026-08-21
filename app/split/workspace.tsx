"use client";
import { useState } from "react";
import { PDFDocument } from "pdf-lib";
import { Download, Loader2, FileText } from "lucide-react";
import Header from "@/components/Header";
import Dropzone from "@/components/Dropzone";
import StatusMessage from "@/components/StatusMessage";
import { isPdf, MAX_FILE_SIZE } from "@/lib/pdf-utils";

function parseRanges(input: string, pageCount: number): number[] | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const indices = new Set<number>();
  const parts = trimmed.split(",");
  for (const part of parts) {
    const p = part.trim();
    if (!p) continue;
    const rangeMatch = p.match(/^(\d+)\s*-\s*(\d+)$/);
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
      return;
    }
    if (f.size > MAX_FILE_SIZE) {
      setError("File is larger than the 50 MB limit.");
      return;
    }
    setLoadingCount(true);
    try {
      const doc = await PDFDocument.load(await f.arrayBuffer());
      setFile(f);
      setPageCount(doc.getPageCount());
    } catch {
      setError("Couldn't read that PDF. It may be corrupted or password-protected.");
    } finally {
      setLoadingCount(false);
    }
  }

  async function split() {
    if (!file || !pageCount) return;
    const indices = parseRanges(ranges, pageCount);
    if (!indices) {
      setError(`Enter valid pages or ranges between 1 and ${pageCount}, e.g. "1-3,5".`);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const src = await PDFDocument.load(await file.arrayBuffer());
      const out = await PDFDocument.create();
      const pages = await out.copyPages(src, indices);
      pages.forEach((p) => out.addPage(p));
      const blob = new Blob([(await out.save()) as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name.replace(/\.pdf$/i, "") + "-split.pdf";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError("Couldn't split that PDF. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen">
      <Header />
      <section className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="text-center">
          <h1 className="font-display text-3xl font-bold sm:text-4xl">Split PDF</h1>
          <p className="mt-3 text-[var(--muted)]">Extract specific pages or ranges into a new PDF.</p>
        </div>

        {!file && (
          <Dropzone
            accept="application/pdf,.pdf"
            onFiles={handleFiles}
            title={loadingCount ? "Reading PDF…" : "Drop a PDF here"}
            subtitle="or click to browse"
          />
        )}

        {file && pageCount && (
          <div className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
            <div className="flex items-center gap-3 border-b border-[var(--border)] pb-4">
              <FileText size={20} className="shrink-0 text-[var(--muted)]" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{file.name}</div>
                <div className="text-xs text-[var(--muted)]">
                  {pageCount} page{pageCount === 1 ? "" : "s"}
                </div>
              </div>
              <button
                onClick={() => {
                  setFile(null);
                  setPageCount(null);
                  setRanges("");
                  setError("");
                }}
                className="shrink-0 text-sm text-[var(--muted)] underline"
              >
                Change file
              </button>
            </div>

            <label className="mt-4 block text-sm font-medium">Pages to extract</label>
            <input
              value={ranges}
              onChange={(e) => setRanges(e.target.value)}
              placeholder={`e.g. 1-3,5,8-${pageCount}`}
              className="mt-2 w-full rounded-xl border border-[var(--border)] px-4 py-3 text-sm outline-none focus:border-[var(--accent)]"
            />
            <p className="mt-2 text-xs text-[var(--muted)]">
              Use commas for individual pages and dashes for ranges. Pages 1–{pageCount}.
            </p>

            <button
              disabled={busy}
              onClick={split}
              className="mt-5 w-full rounded-xl bg-black px-5 py-3.5 font-semibold text-white transition-opacity disabled:opacity-40"
            >
              {busy ? (
                <Loader2 className="mx-auto animate-spin" />
              ) : (
                <>
                  <Download className="mr-2 inline" size={17} />
                  Split & download
                </>
              )}
            </button>
          </div>
        )}

        <StatusMessage>{error}</StatusMessage>
      </section>
    </main>
  );
}
