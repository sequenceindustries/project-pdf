import type { FileRow, JobRow } from "./jobs";
import { signDownload } from "./session";

/** The job shape the browser sees. No internal ids beyond file ids, no owner data. */
export function presentJob(job: JobRow, files: FileRow[]) {
  const purged = Boolean(job.purged_at);
  const link = (f: FileRow, inline = false) => {
    if (purged || !f.blob_id) return null;
    const { exp, sig } = signDownload(f.id, job.owner_hash);
    return `/api/files/${f.id}?exp=${exp}&sig=${encodeURIComponent(sig)}${inline ? "&inline=1" : ""}`;
  };
  const result = (job.result ?? null) as { analyses?: unknown[]; notes?: string[]; plan?: unknown } | null;
  return {
    id: job.id,
    status: job.status,
    instruction: job.instruction,
    progress: job.progress ?? {},
    error: job.error_message ? { code: job.error_code, message: job.error_message } : null,
    plan: job.plan ?? result?.plan ?? null,
    planner: job.planner,
    analyses: result?.analyses ?? [],
    notes: result?.notes ?? [],
    createdAt: job.created_at,
    finishedAt: job.finished_at,
    expiresAt: job.expires_at,
    purged,
    inputs: files
      .filter((f) => f.kind === "input")
      .map((f) => ({ id: f.id, name: f.name, mime: f.mime, size: f.size, pages: f.pages, scanned: Boolean(f.meta?.scanned) })),
    outputs: files
      .filter((f) => f.kind === "output")
      .map((f) => ({
        id: f.id,
        name: f.name,
        mime: f.mime,
        size: f.size,
        pages: f.pages,
        url: link(f),
        previewUrl: f.mime === "application/pdf" || f.mime === "image/jpeg" ? link(f, true) : null,
      })),
  };
}
