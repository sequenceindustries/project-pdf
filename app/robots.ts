import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site";

// Served at /robots.txt with Content-Type: text/plain.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // API routes are not pages; everything else is public.
        disallow: ["/api/"],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
