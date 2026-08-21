"use client";
import { useState } from "react";
import { Download, Loader2, FileText, ImageDown } from "lucide-react";
import Header from "@/components/Header";
import Dropzone from "@/components/Dropzone";
import StatusMessage from "@/components/StatusMessage";
import { isPdf, MAX_FILE_SIZE } from "@/lib/pdf-utils";

const PDFJS_VERSION = "4.10.38";

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
      return;
    }
    if (f.size > MAX_FILE_SIZE) {
      setError("File is larger than the 50 MB limit.");
      return;
    }
    setFile(f);
  }

  async function convert() {
    if (!file) return;
    setBusy(true);
    setError("");
    setProgress("Loading PDF…");
    try {
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.mjs`;

      const data = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data }).promise;
      const baseName = file.name.replace(/\.pdf$/i, "");
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
      }

      if (jpegBlobs.length === 1) {
        const url = URL.createObjectURL(jpegBlobs[0]);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${baseName}.jpg`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } else {
        setProgress("Packaging pages into a zip…");
        const JSZip = (await import("jszip")).default;
        const zip = new JSZip();
        jpegBlobs.forEach((blob, i) => {
          zip.file(`${baseName}-page-${i + 1}.jpg`, blob);
        });
        const zipBlob = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${baseName}-pages.zip`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch {
      setError("Couldn't convert that PDF. It may be corrupted or password-protected.");
    } finally {
      setBusy(false);
      setProgress("");
    }
  }

  return (
    <main className="min-h-screen">
      <Header />
      <section className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="text-center">
          <h1 className="font-display text-3xl font-bold sm:text-4xl">PDF to JPG</h1>
          <p className="mt-3 text-[var(--muted)]">
            Turn each page into a JPG image. Multi-page PDFs download as a zip.
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

            <button
              disabled={busy}
              onClick={convert}
              className="mt-5 w-full rounded-xl bg-black px-5 py-3.5 font-semibold text-white transition-opacity disabled:opacity-40"
            >
              {busy ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="animate-spin" size={17} />
                  {progress || "Converting…"}
                </span>
              ) : (
                <>
                  <ImageDown className="mr-2 inline" size={17} />
                  Convert & download
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
