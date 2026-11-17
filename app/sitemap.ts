import type { MetadataRoute } from "next";
import { SITE_URL, TOOL_PAGES } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/`, priority: 1 },
    { url: `${SITE_URL}/tools`, priority: 0.8 },
    ...TOOL_PAGES.map((t) => ({ url: `${SITE_URL}/${t.path}`, priority: 0.7 })),
  ];
}
