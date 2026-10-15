/** Per-file size limit enforced by every tool. Keep in sync with site.maxFileMb. */
export const MAX_FILE_SIZE = 50 * 1024 * 1024;

export function isPdf(file: File) {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

export function isImage(file: File) {
  return ["image/jpeg", "image/png"].includes(file.type) || /\.(jpg|jpeg|png)$/i.test(file.name);
}

/** pdf-lib is loaded on demand so tool pages stay light until a file is processed. */
export function loadPdfLib() {
  return import("pdf-lib");
}

/**
 * pdf.js with its worker served from this site (bundled at build time), so no
 * third-party CDN is contacted while rendering pages.
 */
export async function loadPdfjs() {
  const pdfjsLib = await import("pdfjs-dist");
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url
    ).toString();
  }
  return pdfjsLib;
}

/** Hands a result to the user as a download, entirely client-side. */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function baseName(file: File) {
  return file.name.replace(/\.pdf$/i, "") || "document";
}
