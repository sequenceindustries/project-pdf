"use client";
import { useState } from "react";
import { PDFDocument } from "pdf-lib";
import { Download, Loader2, Upload, FileText } from "lucide-react";

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

  function handleFile(f: File | undefined) {
    setError("");
    setResult(null);
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
      <header className="border-b bg-white">
        <div className="mx-auto max-w-5xl px-6 py-5">
          <a href="/" className="text-xl font-bold">PDF<span className="text-[var(--accent)]">.</span></a>
        </div>
      </header>
      <section className="mx-auto max-w-4xl px-6 py-14">
        <div className="text-center">
          <h1 className="text-4xl font-bold">Compress PDF</h1>
          <p className="mt-3 text-[var(--muted)]">
            Reduce file size by optimizing PDF structure, right in your browser.
          </p>
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
            <div className="mt-4 text-lg font-semibold">Drop a PDF here</div>
            <div className="mt-2 text-sm text-[var(--muted)]">or click to browse</div>
          </label>
        )}

        {file && (
          <div className="mt-6 rounded-2xl border bg-white p-6">
            <div className="flex items-center gap-3 border-b pb-4">
              <FileText size={20} className="text-[var(--muted)]" />
              <div className="flex-1">
                <div className="truncate text-sm font-medium">{file.name}</div>
                <div className="text-xs text-[var(--muted)]">{formatSize(file.size)}</div>
              </div>
              <button
                onClick={() => {
                  setFile(null);
                  setResult(null);
                  setError("");
                }}
                className="text-sm text-[var(--muted)] underline"
              >
                Change file
              </button>
            </div>

            {!result ? (
              <button
                disabled={busy}
                onClick={compress}
                className="mt-5 w-full rounded-xl bg-black px-5 py-3.5 font-semibold text-white disabled:opacity-40"
              >
                {busy ? <Loader2 className="mx-auto animate-spin" /> : "Compress PDF"}
              </button>
            ) : (
              <div className="mt-5">
                <div className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3 text-sm">
                  <span className="text-[var(--muted)]">{formatSize(file.size)}</span>
                  <span className="font-semibold">→ {formatSize(result.size)}</span>
                  {savedPct !== null && savedPct > 0 && (
                    <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700">
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

        {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      </section>
    </main>
  );
}
