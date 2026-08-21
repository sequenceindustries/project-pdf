export const MAX_FILE_SIZE = 50 * 1024 * 1024;

export function isPdf(file: File) {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

export function isImage(file: File) {
  return ["image/jpeg", "image/png"].includes(file.type) || /\.(jpg|jpeg|png)$/i.test(file.name);
}
