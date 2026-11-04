import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { MAX_CHARS, MAX_PAGES } from "./extract";

/**
 * Partner access: trusted Sequence Industries sites (e.g. I Hate PDF) send
 * already-extracted page text, never the PDF. Authenticated with a shared
 * secret; capped globally per UTC day so a partner can't run up the bill.
 */
export function partnerConfigured() {
  return (process.env.PARTNER_API_KEY ?? "").length >= 32;
}

export function partnerAuthorised(header: string | null): boolean {
  const key = process.env.PARTNER_API_KEY ?? "";
  if (key.length < 32 || !header?.startsWith("Bearer ")) return false;
  const h = (v: string) => createHash("sha256").update(v).digest();
  return timingSafeEqual(h(header.slice(7)), h(key));
}

export const partnerJobSchema = z.object({
  instruction: z.string().trim().min(1).max(1000),
  filename: z.string().max(300).default("document.pdf"),
  pages: z
    .array(z.object({ n: z.number().int().min(1).max(MAX_PAGES), text: z.string().max(MAX_CHARS) }))
    .min(1)
    .max(MAX_PAGES),
});

let day = "";
let used = 0;
/** Global per-day cap across all partner traffic (single replica). */
export function takePartnerQuota(cap = Number(process.env.PEEDF_PARTNER_DAILY_CAP) || 300): boolean {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== day) {
    day = today;
    used = 0;
  }
  if (used >= cap) return false;
  used++;
  return true;
}
export function resetPartnerQuota() {
  day = "";
  used = 0;
}
