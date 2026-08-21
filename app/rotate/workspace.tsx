"use client";
import { useState } from "react";
import { PDFDocument, degrees } from "pdf-lib";
import { Download, Loader2, FileText, RotateCw, RotateCcw } from "lucide-react";
import Header from "@/components/Header";
import Dropzone from "@/components/Dropzone";
import StatusMessage from "@/components/StatusMessage";
import { isPdf, MAX_FILE_SIZE } from "@/lib/pdf-utils";

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
      return;
    }
    if (f.size > MAX_FILE_SIZE) {
      setError("File is larger than the 50 MB limit.");
      return;
    }
    setFile(f);
    setAngle(0);
  }

  function turn(delta: number) {
    setAngle((a) => ((a + delta) % 360 + 360) % 360);
  }

  async function apply() {
    if (!file) return;
    if (angle === 0) {
      setError("Rotate the page before downloading, or it'll be unchanged.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const doc = await PDFDocument.load(await file.arrayBuffer());
      for (const page of doc.getPages()) {
        const current = page.getRotation().angle;
        page.setRotation(degrees((current + angle) % 360));
      }
      const blob = new Blob([(await doc.save()) as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name.replace(/\.pdf$/i, "") + "-rotated.pdf";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError("Couldn't rotate that PDF. It may be corrupted or password-protected.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen">
      <Header />
      <section className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="text-center">
          <h1 className="font-display text-3xl font-bold sm:text-4xl">Rotate PDF</h1>
          <p className="mt-3 text-[var(--muted)]">Rotate every page in a PDF, all at once.</p>
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
              </div>
              <button
                onClick={() => {
                  setFile(null);
                  setError("");
                }}
                className="shrink-0 text-sm text-[var(--muted)] underline"
              >
                Change file
              </button>
            </div>

            <div className="mt-6 flex flex-col items-center">
              <div
                className="flex h-32 w-24 items-center justify-center rounded-lg border-2 border-[var(--fg)] bg-white text-xs text-[var(--muted)] transition-transform duration-300"
                style={{ transform: `rotate(${angle}deg)` }}
              >
                Page
              </div>
              <div className="mt-5 flex gap-3">
                <button
                  onClick={() => turn(-90)}
                  className="flex items-center gap-2 rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-medium hover:border-[var(--fg)]/40"
                >
                  <RotateCcw size={16} />
                  Left 90°
                </button>
                <button
                  onClick={() => turn(90)}
                  className="flex items-center gap-2 rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-medium hover:border-[var(--fg)]/40"
                >
                  <RotateCw size={16} />
                  Right 90°
                </button>
              </div>
              <p className="mt-3 text-xs text-[var(--muted)]">Current: {angle}°</p>
            </div>

            <button
              disabled={busy}
              onClick={apply}
              className="mt-6 w-full rounded-xl bg-black px-5 py-3.5 font-semibold text-white transition-opacity disabled:opacity-40"
            >
              {busy ? (
                <Loader2 className="mx-auto animate-spin" />
              ) : (
                <>
                  <Download className="mr-2 inline" size={17} />
                  Rotate & download
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
