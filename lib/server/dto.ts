import type { JobRow } from "./jobs";
export function toDto(j: JobRow) {
  return {
    id: j.id,
    status: j.status,
    task: j.task,
    instruction: j.instruction,
    filename: j.filename,
    pageCount: j.page_count,
    result: j.status === "completed" ? j.result : null,
    error: j.status === "failed" ? { code: j.error_code, message: j.error_message } : null,
    createdAt: j.created_at,
    expiresAt: j.expires_at,
  };
}
