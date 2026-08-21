"use client";
import { useState } from "react";
import { PDFDocument, rgb, StandardFonts, degrees } from "pdf-lib";
import { Download, Loader2, FileText, Stamp } from "lucide-react";
import Header from "@/components/Header";
import Dropzone from "@/components/Dropzone";
import StatusMessage from "@/components/StatusMessage";
import { isPdf, MAX_FILE_SIZE } from "@/lib/pdf-utils";

const OPACITIES = [
  { label: "Light", value: 0.15 },
  { label: "Medium", value: 0.3 },
  { label: "Bold", value: 0.5 },
];

export default function WatermarkWorkspace() {
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("CONFIDENTIAL");
  const [opacity, setOpacity] = useState(0.3);
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
  }

  async function apply() {
    if (!file) return;
    if (!text.trim()) {
      setError("Enter watermark text.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const doc = await PDFDocument.load(await file.arrayBuffer());
      const font = await doc.embedFont(StandardFonts.HelveticaBold);
      const pages = doc.getPages();
      for (const page of pages) {
        const { width, height } = page.getSize();
        const fontSize = Math.max(24, Math.min(width, height) / 8);
        const textWidth = font.widthOfTextAtSize(text, fontSize);
        page.drawText(text, {
          x: width / 2 - textWidth / 2,
          y: height / 2,
          size: fontSize,
          font,
          color: rgb(0.4, 0.4, 0.4),
          opacity,
          rotate: degrees(45),
        });
      }
      const blob = new Blob([(await doc.save()) as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name.replace(/\.pdf$/i, "") + "-watermarked.pdf";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError("Couldn't watermark that PDF. It may be corrupted or password-protected.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen">
      <Header />
      <section className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="text-center">
          <h1 className="font-display text-3xl font-bold sm:text-4xl">Watermark PDF</h1>
          <p className="mt-3 text-[var(--muted)]">
            Stamp text across every page, entirely in your browser.
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

            <label className="mt-5 block text-sm font-medium">Watermark text</label>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={60}
              className="mt-2 w-full rounded-xl border border-[var(--border)] px-4 py-3 text-sm outline-none focus:border-[var(--accent)]"
            />

            <label className="mt-5 block text-sm font-medium">Intensity</label>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {OPACITIES.map((o) => (
                <button
                  key={o.value}
                  onClick={() => setOpacity(o.value)}
                  className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
                    opacity === o.value
                      ? "border-[var(--fg)] bg-[var(--fg)] text-white"
                      : "border-[var(--border)] hover:border-[var(--fg)]/40"
                  }`}
                >
                  {o.label}
                </button>
              ))}
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
                  <Stamp className="mr-2 inline" size={17} />
                  Apply & download
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
