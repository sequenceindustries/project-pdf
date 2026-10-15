import { config } from "./config";
import { HttpError } from "./http";

/**
 * Upload validation. File type is decided by content (magic bytes), never by
 * the browser-supplied MIME type or extension. Names are sanitised and only
 * ever used as download labels.
 */

export type AcceptedFile = { name: string; mime: "application/pdf" | "image/jpeg" | "image/png"; bytes: Uint8Array };

function sniff(b: Uint8Array): AcceptedFile["mime"] | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return "image/png";
  // PDF header may be preceded by junk; the spec allows it within the first 1024 bytes.
  const head = new TextDecoder("latin1").decode(b.subarray(0, 1024));
  if (head.includes("%PDF-")) return "application/pdf";
  return null;
}

export function sanitizeName(name: string, mime: AcceptedFile["mime"]) {
  const base = (name.split(/[\\/]/).pop() ?? "")
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f<>:"|?*]/g, "")
    .replace(/^\.+/, "")
    .trim()
    .slice(0, 120);
  const ext = mime === "application/pdf" ? ".pdf" : mime === "image/png" ? ".png" : ".jpg";
  const stem = base.replace(/\.[^.]{1,5}$/, "") || "document";
  return stem + ext;
}

export async function readUploads(form: FormData): Promise<{ instruction: string; files: AcceptedFile[] }> {
  const instruction = String(form.get("instruction") ?? "").trim();
  if (!instruction) throw new HttpError(400, "Tell Peedf what you'd like to do with your files.");
  if (instruction.length > config.limits.maxInstructionChars) {
    throw new HttpError(400, `Please keep instructions under ${config.limits.maxInstructionChars} characters.`);
  }
  const entries = form.getAll("files").filter((f): f is File => typeof f === "object" && f !== null && "arrayBuffer" in f);
  if (!entries.length) throw new HttpError(400, "Add at least one PDF or image.");
  if (entries.length > config.limits.maxFilesPerJob) throw new HttpError(400, `You can add up to ${config.limits.maxFilesPerJob} files at a time.`);
  let total = 0;
  const files: AcceptedFile[] = [];
  for (const f of entries) {
    if (f.size === 0) throw new HttpError(400, `${f.name || "A file"} is empty.`);
    if (f.size > config.limits.maxFileBytes) {
      throw new HttpError(413, `${f.name} is larger than the ${Math.round(config.limits.maxFileBytes / 1048576)} MB limit.`);
    }
    total += f.size;
    if (total > config.limits.maxJobBytes) {
      throw new HttpError(413, `Files in one request can total up to ${Math.round(config.limits.maxJobBytes / 1048576)} MB.`);
    }
    const bytes = new Uint8Array(await f.arrayBuffer());
    const mime = sniff(bytes);
    if (!mime) throw new HttpError(415, `${f.name} isn't a PDF, JPG or PNG file.`);
    files.push({ name: sanitizeName(f.name, mime), mime, bytes });
  }
  return { instruction, files };
}
