"use client";
import { useState } from "react";
import { Loader2, FileText, Stamp } from "lucide-react";
import Dropzone from "@/components/Dropzone";
import StatusMessage from "@/components/StatusMessage";
import { baseName, downloadBlob, isPdf, loadPdfLib, MAX_FILE_SIZE } from "@/lib/pdf-utils";
import { durationBand, pageBand, sizeBand, track } from "@/lib/analytics";

const TOOL = "watermark";

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
      track("file_rejected", { tool: TOOL, reason: "type" });
      return;
    }
    if (f.size > MAX_FILE_SIZE) {
      setError("File is larger than the 50 MB limit.");
      track("file_rejected", { tool: TOOL, reason: "size" });
      return;
    }
    setFile(f);
    track("file_added", { tool: TOOL, file_count: 1, size_band: sizeBand(f.size) });
  }

  async function apply() {
    if (!file) return;
    const value = text.trim();
    if (!value) {
      setError("Enter watermark text.");
      return;
    }
    const intensity = OPACITIES.find((o) => o.value === opacity)?.label.toLowerCase() ?? "custom";
    setBusy(true);
    setError("");
    const started = performance.now();
    // The watermark text itself is never sent to analytics.
    track("tool_run", { tool: TOOL, option: intensity });
    try {
      const { PDFDocument, rgb, StandardFonts, degrees } = await loadPdfLib();
      const doc = await PDFDocument.load(await file.arrayBuffer());
      const font = await doc.embedFont(StandardFonts.HelveticaBold);
      try {
        font.encodeText(value);
      } catch {
        setError("That text uses characters the built-in font can't draw. Try standard letters and numbers.");
        track("tool_error", { tool: TOOL, reason: "input" });
        return;
      }
      const pages = doc.getPages();
      for (const page of pages) {
        const { width, height } = page.getSize();
        const fontSize = Math.max(24, Math.min(width, height) / 8);
        const textWidth = font.widthOfTextAtSize(value, fontSize);
        page.drawText(value, {
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
      downloadBlob(blob, `${baseName(file)}-watermarked.pdf`);
      track("tool_complete", {
        tool: TOOL,
        option: intensity,
        output: "pdf",
        page_band: pageBand(pages.length),
        duration_band: durationBand(performance.now() - started),
      });
    } catch {
      setError("Couldn't watermark that PDF. It may be corrupted or password-protected.");
      track("tool_error", { tool: TOOL, reason: "unreadable" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="text-center">
        <h1 className="font-display text-4xl font-extrabold sm:text-5xl">Watermark PDF</h1>
        <p className="mt-3 text-[var(--muted)]">Stamp text across every page, entirely in your browser.</p>
      </div>

      {!file && (
        <Dropzone accept="application/pdf,.pdf" onFiles={handleFiles} title="Drop a PDF here" subtitle="or click to browse" />
      )}

      {file && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            apply();
          }}
          className="mt-6 card-chunky bg-[var(--surface-soft)] p-5 sm:p-6"
        >
          <div className="flex items-center gap-3 border-b border-[var(--border)] pb-4">
            <FileText size={20} className="shrink-0 text-[var(--muted)]" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{file.name}</div>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setFile(null);
                setError("");
              }}
              className="shrink-0 text-sm text-[var(--muted)] underline disabled:opacity-40"
            >
              Change file
            </button>
          </div>

          <label htmlFor="wm-text" className="mt-5 block text-sm font-medium">
            Watermark text
          </label>
          <input
            id="wm-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={60}
            autoComplete="off"
            className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-base outline-none focus:border-[var(--accent)] sm:text-sm"
          />

          <fieldset className="mt-5">
            <legend className="block text-sm font-medium">Intensity</legend>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {OPACITIES.map((o) => (
                <button
                  type="button"
                  key={o.value}
                  aria-pressed={opacity === o.value}
                  onClick={() => setOpacity(o.value)}
                  className={`rounded-[0.9rem] border-2 px-3 py-2.5 text-sm font-bold transition-colors ${
                    opacity === o.value
                      ? "border-[var(--accent-dark)] bg-[var(--accent)] text-white"
                      : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent)]/50"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </fieldset>

          <button
            type="submit"
            disabled={busy}
            aria-busy={busy}
            className="mt-6 w-full btn btn-primary px-5 py-3.5 disabled:opacity-40"
          >
            {busy ? (
              <>
                <Loader2 className="mx-auto animate-spin" aria-hidden="true" />
                <span className="sr-only">Applying watermark…</span>
              </>
            ) : (
              <>
                <Stamp className="mr-2 inline" size={17} aria-hidden="true" />
                Apply & download
              </>
            )}
          </button>
        </form>
      )}

      <StatusMessage>{error}</StatusMessage>
    </section>
  );
}
