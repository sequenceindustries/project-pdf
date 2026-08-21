"use client";
import { useState } from "react";
import { PDFDocument } from "pdf-lib";
import { Download, Loader2, Upload, FileText } from "lucide-react";

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

  async function handleFile(f: File | undefined) {
    setError("");
    setFile(null);
    setPageCount(null);
    if (!f) return;
    const isPdf = f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      setError("Please choose a PDF file.");
      return;
    }
    if (f.size > 50 * 1024 * 1024) {
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
      const blob = new Blob([await out.save() as BlobPart], { type: "application/pdf" });
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
      <header className="border-b bg-white">
        <div className="mx-auto max-w-5xl px-6 py-5">
          <a href="/" className="text-xl font-bold">PDF<span className="text-[var(--accent)]">.</span></a>
        </div>
      </header>
      <section className="mx-auto max-w-4xl px-6 py-14">
        <div className="text-center">
          <h1 className="text-4xl font-bold">Split PDF</h1>
          <p className="mt-3 text-[var(--muted)]">Extract specific pages or ranges into a new PDF.</p>
        </div>

        {!file && (
          <label
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              handleFile(e.dataTransfer.files?.[0]);
            }}
            className="mt-10 flex cursor-pointer flex-col items-center rounded-3xl border-2 border-dashed bg-white px-6 py-14 text-center"
          >
            <input
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(e) => {
                handleFile(e.target.files?.[0]);
                e.currentTarget.value = "";
              }}
            />
            <Upload size={30} />
            <div className="mt-4 text-lg font-semibold">
              {loadingCount ? "Reading PDF…" : "Drop a PDF here"}
            </div>
            <div className="mt-2 text-sm text-[var(--muted)]">or click to browse</div>
          </label>
        )}

        {file && pageCount && (
          <div className="mt-6 rounded-2xl border bg-white p-6">
            <div className="flex items-center gap-3 border-b pb-4">
              <FileText size={20} className="text-[var(--muted)]" />
              <div className="flex-1">
                <div className="truncate text-sm font-medium">{file.name}</div>
                <div className="text-xs text-[var(--muted)]">{pageCount} page{pageCount === 1 ? "" : "s"}</div>
              </div>
              <button
                onClick={() => {
                  setFile(null);
                  setPageCount(null);
                  setRanges("");
                  setError("");
                }}
                className="text-sm text-[var(--muted)] underline"
              >
                Change file
              </button>
            </div>

            <label className="mt-4 block text-sm font-medium">Pages to extract</label>
            <input
              value={ranges}
              onChange={(e) => setRanges(e.target.value)}
              placeholder={`e.g. 1-3,5,8-${pageCount}`}
              className="mt-2 w-full rounded-xl border px-4 py-3 text-sm outline-none focus:border-black"
            />
            <p className="mt-2 text-xs text-[var(--muted)]">
              Use commas for individual pages and dashes for ranges. Pages 1–{pageCount}.
            </p>

            <button
              disabled={busy}
              onClick={split}
              className="mt-5 w-full rounded-xl bg-black px-5 py-3.5 font-semibold text-white disabled:opacity-40"
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

        {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      </section>
    </main>
  );
}
