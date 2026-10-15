/**
 * Site-wide constants. Everything that builds an absolute URL (canonicals,
 * sitemap, robots, Open Graph, JSON-LD, the canonical-host redirect) reads
 * from here, so the public origin lives in exactly one place.
 */

function normalizeOrigin(value: string | undefined): string {
  const fallback = "https://peedf.com";
  if (!value) return fallback;
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.host}`;
  } catch {
    return fallback;
  }
}

export const site = {
  name: "peedf",
  /** Canonical public origin, no trailing slash. Override with NEXT_PUBLIC_SITE_URL. */
  url: normalizeOrigin(process.env.NEXT_PUBLIC_SITE_URL),
  tagline: "PDFs, without the headache.",
  description:
    "Merge, split, compress, convert, rotate, watermark and password-protect PDFs. Every tool runs on your own device, so your files are never uploaded.",
  /** Per-file size limit enforced by every tool (see lib/pdf-utils.ts). */
  maxFileMb: 50,
  publisher: "Sequence Industries",
  locale: "en",
} as const;

export const canonicalHost = new URL(site.url).host;

export function absoluteUrl(path = "/"): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return clean === "/" ? `${site.url}/` : `${site.url}${clean}`;
}
