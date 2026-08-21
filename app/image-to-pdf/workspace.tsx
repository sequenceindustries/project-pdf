"use client";
import { useEffect, useRef, useState } from "react";
import { PDFDocument } from "pdf-lib";
import { Download, Loader2, Trash2, ArrowUp, ArrowDown, ImagePlus } from "lucide-react";
import Header from "@/components/Header";
import Dropzone from "@/components/Dropzone";
import StatusMessage from "@/components/StatusMessage";
import { isImage, MAX_FILE_SIZE } from "@/lib/pdf-utils";

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
    let rejected = false;
    for (const f of files) {
      if (!isImage(f) || f.size > MAX_FILE_SIZE) {
        rejected = true;
        continue;
      }
      const url = URL.createObjectURL(f);
      urlsRef.current.push(url);
      accepted.push({ file: f, url });
    }
    if (accepted.length) setItems((x) => [...x, ...accepted]);
    if (rejected) setError("Only JPG and PNG images up to 50 MB each are accepted.");
    else setError("");
  }

  function remove(i: number) {
    setItems((x) => x.filter((_, j) => j !== i));
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
    try {
      const doc = await PDFDocument.create();
      for (const { file } of items) {
        const bytes = await file.arrayBuffer();
        const isPng = file.type === "image/png" || /\.png$/i.test(file.name);
        const image = isPng ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
        const page = doc.addPage([image.width, image.height]);
        page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
      }
      const blob = new Blob([(await doc.save()) as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "images.pdf";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError("Couldn't convert one of the images. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen">
      <Header />
      <section className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="text-center">
          <h1 className="font-display text-3xl font-bold sm:text-4xl">JPG to PDF</h1>
          <p className="mt-3 text-[var(--muted)]">
            Convert one or more images into a single PDF document.
          </p>
        </div>

        <Dropzone
          accept="image/jpeg,image/png,.jpg,.jpeg,.png"
          multiple
          onFiles={add}
          title="Drop images here"
          subtitle="or click to browse — JPG or PNG"
        />

        {items.length > 0 && (
          <div className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <p className="mb-3 px-2 text-xs text-[var(--muted)]">
              Reorder images with the arrows — this sets the page order in the PDF.
            </p>
            {items.map((item, i) => (
              <div
                key={item.url}
                className="flex items-center gap-3 border-b border-[var(--border)] p-3 last:border-0"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.url}
                  alt={item.file.name}
                  className="h-12 w-12 shrink-0 rounded-lg border border-[var(--border)] object-cover"
                />
                <span className="min-w-0 flex-1 truncate text-sm">
                  {i + 1}. {item.file.name}
                </span>
                <button
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  className="shrink-0 disabled:opacity-30"
                  aria-label="Move up"
                >
                  <ArrowUp size={16} />
                </button>
                <button
                  onClick={() => move(i, 1)}
                  disabled={i === items.length - 1}
                  className="shrink-0 disabled:opacity-30"
                  aria-label="Move down"
                >
                  <ArrowDown size={16} />
                </button>
                <button onClick={() => remove(i)} className="shrink-0" aria-label="Remove">
                  <Trash2 size={17} />
                </button>
              </div>
            ))}
            <button
              disabled={busy}
              onClick={convert}
              className="mt-4 w-full rounded-xl bg-black px-5 py-3.5 font-semibold text-white transition-opacity disabled:opacity-40"
            >
              {busy ? (
                <Loader2 className="mx-auto animate-spin" />
              ) : (
                <>
                  <ImagePlus className="mr-2 inline" size={17} />
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
