import { config } from "./config";

/**
 * Structured operational logging.
 *
 * Never log file names, file contents, extracted text, instructions, AI
 * output or IP addresses. Log ids, statuses, counts, durations and error
 * codes only. Every event can optionally be forwarded to MOTHER via
 * EVENTS_WEBHOOK_URL (the same convention iHatePDF uses).
 */

export type OpsEvent =
  | "job_created"
  | "job_started"
  | "job_completed"
  | "job_failed"
  | "job_retry"
  | "job_cancelled"
  | "job_needs_input"
  | "step_failed"
  | "ai_call"
  | "api_error"
  | "sweep"
  | "worker_started"
  | "worker_stopped";

type Fields = Record<string, string | number | boolean | null | undefined>;

export function log(level: "info" | "warn" | "error", event: OpsEvent | string, fields: Fields = {}) {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, event, service: "peedf", ...fields });
  if (level === "error") console.error(line);
  else console.log(line);
}

export function emit(event: OpsEvent, fields: Fields = {}, level: "info" | "warn" | "error" = "info") {
  log(level, event, fields);
  if (!config.eventsWebhookUrl) return;
  const body = JSON.stringify({ source: "peedf", event, at: new Date().toISOString(), ...fields });
  fetch(config.eventsWebhookUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(config.eventsWebhookSecret ? { authorization: `Bearer ${config.eventsWebhookSecret}` } : {}),
    },
    body,
    signal: AbortSignal.timeout(3000),
  }).catch(() => {
    // Monitoring must never affect processing.
  });
}
