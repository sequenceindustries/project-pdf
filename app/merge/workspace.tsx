"use client";
import { useState } from "react";
import { PDFDocument } from "pdf-lib";
import { Download, Loader2, Trash2, Combine } from "lucide-react";
import Header from "@/components/Header";
import Dropzone from "@/components/Dropzone";
import StatusMessage from "@/components/StatusMessage";
import { isPdf, MAX_FILE_SIZE } from "@/lib/pdf-utils";

export default function MergeWorkspace() {
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function add(fs: File[]) {
    const ok = fs.filter((f) => isPdf(f) && f.size <= MAX_FILE_SIZE);
    setFiles((x) => [...x, ...ok]);
    if (ok.length !== fs.length) setError("Only PDF files up to 50 MB each are accepted.");
    else setError("");
  }

  async function merge() {
    if (files.length < 2) {
      setError("Add at least two PDFs.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const out = await PDFDocument.create();
      for (const f of files) {
        const src = await PDFDocument.load(await f.arrayBuffer());
        const pages = await out.copyPages(src, src.getPageIndices());
        pages.forEach((p) => out.addPage(p));
      }
      const blob = new Blob([(await out.save()) as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "merged.pdf";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError("Could not process one of the PDFs.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen">
      <Header />
      <section className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="text-center">
          <h1 className="font-display text-3xl font-bold sm:text-4xl">Merge PDF</h1>
          <p className="mt-3 text-[var(--muted)]">Combine multiple PDF files into one document.</p>
        </div>

        <Dropzone
          accept="application/pdf,.pdf"
          multiple
          onFiles={add}
          title="Drop PDFs here"
          subtitle="or click to browse"
        />

        {files.length > 0 && (
          <div className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
            {files.map((f, i) => (
              <div
                key={i}
                className="flex items-center gap-3 border-b border-[var(--border)] p-3 last:border-0"
              >
                <span className="min-w-0 flex-1 truncate text-sm">
                  {i + 1}. {f.name}
                </span>
                <button
                  onClick={() => setFiles((x) => x.filter((_, j) => j !== i))}
                  className="shrink-0"
                  aria-label="Remove"
                >
                  <Trash2 size={17} />
                </button>
              </div>
            ))}
            <button
              disabled={busy}
              onClick={merge}
              className="mt-4 w-full rounded-xl bg-black px-5 py-3.5 font-semibold text-white transition-opacity disabled:opacity-40"
            >
              {busy ? (
                <Loader2 className="mx-auto animate-spin" />
              ) : (
                <>
                  <Combine className="mr-2 inline" size={17} />
                  Merge & download
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
