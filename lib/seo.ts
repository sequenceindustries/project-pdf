import type { Metadata } from "next";
import { absoluteUrl, site } from "@/lib/site";
import { getTool, type ToolSlug } from "@/lib/tools";

/** Metadata for a normal page: unique title + description, self-canonical, OG/Twitter. */
export function pageMetadata({
  path,
  title,
  description,
  absoluteTitle = false,
}: {
  path: string;
  title: string;
  description: string;
  absoluteTitle?: boolean;
}): Metadata {
  const fullTitle = absoluteTitle ? title : `${title} · ${site.name}`;
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: absoluteUrl(path) },
    openGraph: {
      type: "website",
      siteName: site.name,
      locale: "en_US",
      url: absoluteUrl(path),
      title: fullTitle,
      description,
    },
    twitter: { card: "summary_large_image", title: fullTitle, description },
  };
}

export function toolMetadata(slug: ToolSlug): Metadata {
  const t = getTool(slug);
  return pageMetadata({ path: `/${t.slug}`, title: t.title, description: t.metaDescription });
}
