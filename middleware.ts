import { NextResponse, type NextRequest } from "next/server";
import { canonicalHost } from "@/lib/site";

/**
 * Canonical host + HTTPS enforcement.
 *
 * Any request that reaches the app on a non-canonical host (www.peedf.com,
 * the *.up.railway.app address, etc.) or over plain HTTP is permanently
 * redirected to https://peedf.com with the same path and query. Local
 * development and private/internal hosts are left alone.
 */

function isLocalOrInternal(host: string) {
  const name = host.split(":")[0].toLowerCase();
  return (
    name === "localhost" ||
    name === "127.0.0.1" ||
    name === "[::1]" ||
    name.endsWith(".localhost") ||
    name.endsWith(".internal") ||
    /^\d+\.\d+\.\d+\.\d+$/.test(name)
  );
}

export function middleware(req: NextRequest) {
  if (process.env.NODE_ENV !== "production") return NextResponse.next();

  const host = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "").toLowerCase();
  if (!host || isLocalOrInternal(host)) return NextResponse.next();

  const proto = req.headers.get("x-forwarded-proto")?.split(",")[0].trim();
  const wrongHost = host !== canonicalHost;
  const insecure = proto === "http";

  if (wrongHost || insecure) {
    const target = new URL(req.nextUrl.pathname + req.nextUrl.search, `https://${canonicalHost}`);
    return NextResponse.redirect(target, 308);
  }

  return NextResponse.next();
}

export const config = {
  // Skip build assets and the health check; everything else is covered.
  matcher: ["/((?!_next/static|_next/image|api/health).*)"],
};
