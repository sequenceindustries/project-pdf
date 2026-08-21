"use client";
import { useState } from "react";
import { PDFDocument } from "pdf-lib";
import { Download, Loader2, FileText, Minimize2 } from "lucide-react";
import Header from "@/components/Header";
import Dropzone from "@/components/Dropzone";
import StatusMessage from "@/components/StatusMessage";
import { isPdf, MAX_FILE_SIZE } from "@/lib/pdf-utils";

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function CompressWorkspace() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ blob: Blob; size: number } | null>(null);

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
      const doc = await PDFDocument.load(await file.arrayBuffer(), {
        updateMetadata: false,
      });
      doc.setTitle("");
      doc.setSubject("");
      doc.setKeywords([]);
      doc.setProducer("");
      doc.setCreator("");
      const bytes = await doc.save({
        useObjectStreams: true,
        addDefaultPage: false,
      });
      const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
      setResult({ blob, size: blob.size });
    } catch {
      setError("Couldn't compress that PDF. It may be corrupted or password-protected.");
    } finally {
      setBusy(false);
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
            Reduce file size by optimizing PDF structure, right in your browser.
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
              <button
                disabled={busy}
                onClick={compress}
                className="mt-5 w-full rounded-xl bg-black px-5 py-3.5 font-semibold text-white transition-opacity disabled:opacity-40"
              >
                {busy ? (
                  <Loader2 className="mx-auto animate-spin" />
                ) : (
                  <>
                    <Minimize2 className="mr-2 inline" size={17} />
                    Compress PDF
                  </>
                )}
              </button>
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
                {savedPct === 0 && (
                  <p className="mt-2 text-xs text-[var(--muted)]">
                    This PDF was already well-optimized, or most of its size comes from embedded
                    images that structural compression can&apos;t reduce further.
                  </p>
                )}
                <button
                  onClick={download}
                  className="mt-4 w-full rounded-xl bg-black px-5 py-3.5 font-semibold text-white"
                >
                  <Download className="mr-2 inline" size={17} />
                  Download compressed PDF
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
