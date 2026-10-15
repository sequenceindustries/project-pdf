"use client";
import { useEffect, useRef, useState } from "react";
import { Loader2, Trash2, ArrowUp, ArrowDown, ImagePlus } from "lucide-react";
import Dropzone from "@/components/Dropzone";
import StatusMessage from "@/components/StatusMessage";
import { downloadBlob, isImage, loadPdfLib, MAX_FILE_SIZE } from "@/lib/pdf-utils";
import { durationBand, pageBand, sizeBand, track } from "@/lib/analytics";

const TOOL = "image-to-pdf";

type Item = { file: File; url: string };

export default function ImageToPdfWorkspace() {
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const urlsRef = useRef<string[]>([]);

  useEffect(() => {
    return () => {
      urlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    };
  }, []);

  function add(files: File[]) {
    const accepted: Item[] = [];
    let rejected: "type" | "size" | null = null;
    for (const f of files) {
      if (!isImage(f)) {
        rejected = "type";
        continue;
      }
      if (f.size > MAX_FILE_SIZE) {
        rejected = rejected ?? "size";
        continue;
      }
      const url = URL.createObjectURL(f);
      urlsRef.current.push(url);
      accepted.push({ file: f, url });
    }
    if (accepted.length) {
      setItems((x) => [...x, ...accepted]);
      track("file_added", {
        tool: TOOL,
        file_count: accepted.length,
        size_band: sizeBand(accepted.reduce((n, it) => n + it.file.size, 0)),
      });
    }
    if (rejected) {
      setError("Only JPG and PNG images up to 50 MB each are accepted.");
      track("file_rejected", { tool: TOOL, reason: rejected });
    } else setError("");
  }

  function remove(i: number) {
    setItems((x) => {
      const it = x[i];
      if (it) URL.revokeObjectURL(it.url);
      return x.filter((_, j) => j !== i);
    });
  }

  function move(i: number, dir: -1 | 1) {
    setItems((x) => {
      const next = [...x];
      const target = i + dir;
      if (target < 0 || target >= next.length) return x;
      [next[i], next[target]] = [next[target], next[i]];
      return next;
    });
  }

  async function convert() {
    if (items.length === 0) {
      setError("Add at least one image.");
      return;
    }
    setBusy(true);
    setError("");
    const started = performance.now();
    track("tool_run", { tool: TOOL, file_count: items.length });
    try {
      const { PDFDocument } = await loadPdfLib();
      const doc = await PDFDocument.create();
      for (const { file } of items) {
        const bytes = await file.arrayBuffer();
        const isPng = file.type === "image/png" || /\.png$/i.test(file.name);
        const image = isPng ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
        const page = doc.addPage([image.width, image.height]);
        page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
      }
      const blob = new Blob([(await doc.save()) as BlobPart], { type: "application/pdf" });
      downloadBlob(blob, "images.pdf");
      track("tool_complete", {
        tool: TOOL,
        output: "pdf",
        page_band: pageBand(items.length),
        duration_band: durationBand(performance.now() - started),
      });
    } catch {
      setError("Couldn't convert one of the images. Please try again.");
      track("tool_error", { tool: TOOL, reason: "unreadable" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="text-center">
        <h1 className="font-display text-4xl font-extrabold sm:text-5xl">JPG to PDF</h1>
        <p className="mt-3 text-[var(--muted)]">Convert one or more images into a single PDF document.</p>
      </div>

      <Dropzone
        accept="image/jpeg,image/png,.jpg,.jpeg,.png"
        multiple
        disabled={busy}
        onFiles={add}
        title="Drop images here"
        subtitle="or click to browse — JPG or PNG"
      />

      {items.length > 0 && (
        <div className="mt-6 card-chunky bg-[var(--surface-soft)] p-4">
          <p className="mb-3 px-2 text-xs text-[var(--muted)]">
            Reorder images with the arrows — this sets the page order in the PDF.
          </p>
          <ol aria-label="Images, in page order">
            {items.map((item, i) => (
              <li key={item.url} className="flex items-center gap-3 border-b border-[var(--border)] p-3 last:border-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.url}
                  alt=""
                  className="h-12 w-12 shrink-0 rounded-lg border border-[var(--border)] object-cover"
                />
                <span className="min-w-0 flex-1 truncate text-sm">
                  {i + 1}. {item.file.name}
                </span>
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0 || busy}
                  className="shrink-0 rounded-md p-1 disabled:opacity-30"
                  aria-label={`Move ${item.file.name} up`}
                >
                  <ArrowUp size={16} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === items.length - 1 || busy}
                  className="shrink-0 rounded-md p-1 disabled:opacity-30"
                  aria-label={`Move ${item.file.name} down`}
                >
                  <ArrowDown size={16} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => remove(i)}
                  disabled={busy}
                  className="shrink-0 rounded-md p-1 disabled:opacity-30"
                  aria-label={`Remove ${item.file.name}`}
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
            onClick={convert}
            className="mt-4 w-full btn btn-primary px-5 py-3.5 disabled:opacity-40"
          >
            {busy ? (
              <>
                <Loader2 className="mx-auto animate-spin" aria-hidden="true" />
                <span className="sr-only">Converting…</span>
              </>
            ) : (
              <>
                <ImagePlus className="mr-2 inline" size={17} aria-hidden="true" />
                Convert & download
              </>
            )}
          </button>
        </div>
      )}

      <StatusMessage>{error}</StatusMessage>
    </section>
  );
}
