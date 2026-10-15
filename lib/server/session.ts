import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { config } from "./config";

/**
 * Anonymous visitor identity.
 *
 * There are no accounts yet. Each browser gets a random visitor id in an
 * HttpOnly, signed cookie. Jobs store only sha256(visitor id) as owner, and
 * every job/file request must present the cookie whose hash matches. When
 * accounts arrive, the owner hash becomes a user id; nothing else changes.
 */

export const VISITOR_COOKIE = "peedf_vid";

let devSecret: string | null = null;
function secret(): string {
  if (config.sessionSecret) return config.sessionSecret;
  if (config.isProduction) throw new Error("SESSION_SECRET is not set");
  devSecret ??= randomBytes(32).toString("hex");
  return devSecret;
}

function hmac(value: string) {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function newVisitorCookieValue() {
  const id = randomBytes(24).toString("base64url");
  return `${id}.${hmac(`vid:${id}`)}`;
}

/** Returns the visitor id if the cookie value is authentic, else null. */
export function readVisitor(cookieValue: string | undefined | null): string | null {
  if (!cookieValue) return null;
  const [id, sig] = cookieValue.split(".");
  if (!id || !sig || id.length < 20) return null;
  return safeEqual(sig, hmac(`vid:${id}`)) ? id : null;
}

export function ownerHash(visitorId: string) {
  return createHash("sha256").update(`owner:${visitorId}`).digest("hex");
}

/** IPs are only stored hashed (with the server secret) for rate limiting. */
export function ipHash(ip: string | null) {
  if (!ip) return null;
  return hmac(`ip:${ip}`).slice(0, 32);
}

/** Expiring download signature, bound to the file and its owner. */
export function signDownload(fileId: string, owner: string, ttlSeconds = config.downloadLinkTtlSeconds) {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  return { exp, sig: hmac(`dl:${fileId}:${owner}:${exp}`) };
}

export function verifyDownload(fileId: string, owner: string, exp: number, sig: string) {
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false;
  return safeEqual(sig, hmac(`dl:${fileId}:${owner}:${exp}`));
}
