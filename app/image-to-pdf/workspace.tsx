"use client";
import { useEffect, useRef, useState } from "react";
import { PDFDocument } from "pdf-lib";
import { Download, Loader2, Trash2, Upload, ArrowUp, ArrowDown } from "lucide-react";

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
      const isImage =
        ["image/jpeg", "image/png"].includes(f.type) || /\.(jpg|jpeg|png)$/i.test(f.name);
      if (!isImage || f.size > 50 * 1024 * 1024) {
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
      const blob = new Blob([await doc.save() as BlobPart], { type: "application/pdf" });
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
      <header className="border-b bg-white">
        <div className="mx-auto max-w-5xl px-6 py-5">
          <a href="/" className="text-xl font-bold">PDF<span className="text-[var(--accent)]">.</span></a>
        </div>
      </header>
      <section className="mx-auto max-w-4xl px-6 py-14">
        <div className="text-center">
          <h1 className="text-4xl font-bold">JPG to PDF</h1>
          <p className="mt-3 text-[var(--muted)]">
            Convert one or more images into a single PDF document.
          </p>
        </div>

        <label
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            add(Array.from(e.dataTransfer.files));
          }}
          className="mt-10 flex cursor-pointer flex-col items-center rounded-3xl border-2 border-dashed bg-white px-6 py-14 text-center"
        >
          <input
            type="file"
            accept="image/jpeg,image/png,.jpg,.jpeg,.png"
            multiple
            className="hidden"
            onChange={(e) => {
              add(Array.from(e.target.files || []));
              e.currentTarget.value = "";
            }}
          />
          <Upload size={30} />
          <div className="mt-4 text-lg font-semibold">Drop images here</div>
          <div className="mt-2 text-sm text-[var(--muted)]">or click to browse — JPG or PNG</div>
        </label>

        {items.length > 0 && (
          <div className="mt-6 rounded-2xl border bg-white p-4">
            <p className="mb-3 px-2 text-xs text-[var(--muted)]">
              Reorder images with the arrows — this sets the page order in the PDF.
            </p>
            {items.map((item, i) => (
              <div
                key={item.url}
                className="flex items-center gap-3 border-b p-3 last:border-0"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.url}
                  alt={item.file.name}
                  className="h-12 w-12 rounded-lg border object-cover"
                />
                <span className="flex-1 truncate text-sm">
                  {i + 1}. {item.file.name}
                </span>
                <button
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  className="disabled:opacity-30"
                  aria-label="Move up"
                >
                  <ArrowUp size={16} />
                </button>
                <button
                  onClick={() => move(i, 1)}
                  disabled={i === items.length - 1}
                  className="disabled:opacity-30"
                  aria-label="Move down"
                >
                  <ArrowDown size={16} />
                </button>
                <button onClick={() => remove(i)} aria-label="Remove">
                  <Trash2 size={17} />
                </button>
              </div>
            ))}
            <button
              disabled={busy}
              onClick={convert}
              className="mt-4 w-full rounded-xl bg-black px-5 py-3.5 font-semibold text-white disabled:opacity-40"
            >
              {busy ? (
                <Loader2 className="mx-auto animate-spin" />
              ) : (
                <>
                  <Download className="mr-2 inline" size={17} />
                  Convert & download
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
