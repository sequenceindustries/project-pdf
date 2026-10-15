"use client";

/**
 * Consent-aware analytics for peedf (GA4 via gtag.js).
 *
 * - Nothing loads from Google until the visitor chooses "Allow" in the consent
 *   banner (Google Consent Mode "basic" setup). Declining means no Google
 *   requests at all.
 * - track() only ever sends the small, fixed set of parameters below. Never
 *   pass file names, file contents, page text, passwords or watermark text.
 */

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * GA4 measurement ID. Set NEXT_PUBLIC_GA_ID to override, or "off" to disable.
 * The default is the Peedf web stream ID already committed to this repo.
 */
const RAW_GA_ID = process.env.NEXT_PUBLIC_GA_ID ?? "G-2X1XTPV299";
export const GA_ID = /^G-[A-Z0-9]{6,}$/.test(RAW_GA_ID) ? RAW_GA_ID : null;

export const CONSENT_KEY = "peedf-analytics-consent";
export const CONSENT_EVENT = "peedf:consent";
export type Consent = "granted" | "denied";

export function readConsent(): Consent | null {
  try {
    const v = window.localStorage.getItem(CONSENT_KEY);
    return v === "granted" || v === "denied" ? v : null;
  } catch {
    return null;
  }
}

export function writeConsent(value: Consent | null) {
  try {
    if (value) window.localStorage.setItem(CONSENT_KEY, value);
    else window.localStorage.removeItem(CONSENT_KEY);
  } catch {
    // Storage blocked: the choice still applies for this page view.
  }
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: value }));
}

export type ToolEvent =
  | "file_added"
  | "file_rejected"
  | "tool_run"
  | "tool_complete"
  | "tool_error";

type Params = {
  tool: string;
  file_count?: number;
  size_band?: string;
  reason?: "type" | "size" | "unreadable" | "input";
  option?: string;
  output?: "pdf" | "jpg" | "zip";
  page_band?: string;
  duration_band?: string;
  result?: string;
};

const ALLOWED = new Set([
  "tool",
  "file_count",
  "size_band",
  "reason",
  "option",
  "output",
  "page_band",
  "duration_band",
  "result",
]);

export function track(name: ToolEvent, params: Params) {
  if (typeof window === "undefined" || !GA_ID) return;
  if (readConsent() !== "granted" || typeof window.gtag !== "function") return;
  const clean: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(params)) {
    if (ALLOWED.has(k) && (typeof v === "string" || typeof v === "number")) clean[k] = v;
  }
  try {
    window.gtag("event", name, clean);
  } catch {
    // Analytics must never break a tool.
  }
}

/** Coarse buckets so no exact sizes or counts are sent. */
export function sizeBand(totalBytes: number): string {
  const mb = totalBytes / (1024 * 1024);
  if (mb < 1) return "<1MB";
  if (mb < 5) return "1-5MB";
  if (mb < 20) return "5-20MB";
  return "20-50MB+";
}

export function pageBand(pages: number): string {
  if (pages <= 1) return "1";
  if (pages <= 5) return "2-5";
  if (pages <= 20) return "6-20";
  if (pages <= 100) return "21-100";
  return "100+";
}

export function durationBand(ms: number): string {
  const s = ms / 1000;
  if (s < 1) return "<1s";
  if (s < 5) return "1-5s";
  if (s < 30) return "5-30s";
  return "30s+";
}
