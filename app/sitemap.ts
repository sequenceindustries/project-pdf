import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site";
import { staticPages, tools } from "@/lib/tools";

// Served at /sitemap.xml with Content-Type: application/xml.
// Generated from the page registries, so adding or editing a tool in
// lib/tools.ts updates the sitemap on the next build. Only canonical,
// indexable pages are listed: no query strings, API routes, tool states
// or duplicate hosts.
export default function sitemap(): MetadataRoute.Sitemap {
  const pages = staticPages.map((p) => ({
    url: absoluteUrl(p.path),
    lastModified: new Date(`${p.updated}T00:00:00Z`),
    changeFrequency: "monthly" as const,
    priority: p.priority,
  }));

  const toolPages = tools.map((t) => ({
    url: absoluteUrl(`/${t.slug}`),
    lastModified: new Date(`${t.updated}T00:00:00Z`),
    changeFrequency: "monthly" as const,
    priority: 0.9,
  }));

  return [...pages, ...toolPages];
}
