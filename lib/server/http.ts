import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { config, workspaceConfigured } from "./config";
import { migrate } from "./db";
import { log } from "./events";
import { ipHash, newVisitorCookieValue, ownerHash, readVisitor, VISITOR_COOKIE } from "./session";

let migrated: Promise<void> | null = null;

/** Ensures the schema exists before the first request in this process. */
export function ready() {
  if (!workspaceConfigured()) throw new HttpError(503, "The workspace isn't available right now.");
  migrated ??= migrate().catch((e) => {
    migrated = null;
    throw e;
  });
  return migrated;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "cache-control": "no-store" } });
}

export function errorResponse(e: unknown, route: string) {
  if (e instanceof HttpError) return json({ error: e.message }, e.status);
  if (e && typeof e === "object" && "status" in e && typeof (e as { status: unknown }).status === "number" && e instanceof Error) {
    return json({ error: e.message }, (e as { status: number }).status);
  }
  log("error", "api_error", { route, error: e instanceof Error ? e.name : "unknown" });
  return json({ error: "Something went wrong on our side. Please try again." }, 500);
}

/** Returns the visitor's owner hash, creating the signed cookie if needed. */
export async function visitor(create: boolean): Promise<{ owner: string } | null> {
  const jar = await cookies();
  let id = readVisitor(jar.get(VISITOR_COOKIE)?.value);
  if (!id) {
    if (!create) return null;
    const value = newVisitorCookieValue();
    jar.set(VISITOR_COOKIE, value, {
      httpOnly: true,
      secure: config.isProduction,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
    id = readVisitor(value)!;
  }
  return { owner: ownerHash(id) };
}

export async function clientIpHash() {
  const h = await headers();
  // Railway's edge sets X-Real-IP and appends the client to X-Forwarded-For.
  // The leftmost XFF entry is client-controlled, so never trust it.
  const xff = h.get("x-forwarded-for")?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];
  const ip = h.get("x-real-ip")?.trim() || xff[xff.length - 1] || null;
  return ipHash(ip);
}

/** Rejects cross-site state-changing requests (defence in depth on top of SameSite=Lax). */
export async function assertSameOrigin() {
  const h = await headers();
  const origin = h.get("origin");
  if (!origin) return; // same-origin fetches from older browsers / curl in dev
  const host = h.get("x-forwarded-host") ?? h.get("host");
  try {
    if (new URL(origin).host !== host) throw new HttpError(403, "Cross-site request blocked.");
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(403, "Cross-site request blocked.");
  }
}
