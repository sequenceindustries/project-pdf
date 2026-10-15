import type { Metadata } from "next";
import Header from "@/components/Header";
import ToolGrid from "@/components/ToolGrid";
import Footer from "@/components/Footer";
import JsonLd from "@/components/JsonLd";
import { pageMetadata } from "@/lib/seo";
import { absoluteUrl } from "@/lib/site";
import { tools } from "@/lib/tools";

export const metadata: Metadata = pageMetadata({
  path: "/tools",
  title: "All PDF tools",
  description:
    "Every peedf tool in one place: compress, merge, split, rotate, watermark, password-protect, PDF to JPG and JPG to PDF. All eight run on your own device.",
});

export default function Tools() {
  return (
    <>
      <Header />
      <main id="main" className="min-h-screen">
        <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-20">
          <h1 className="font-display text-4xl font-extrabold sm:text-5xl">All tools</h1>
          <p className="mt-3 text-[var(--muted)]">Eight ways to handle a PDF, all running on your device.</p>
          <div className="mt-10">
            <ToolGrid headingLevel="h2" />
          </div>
        </div>
      </main>
      <Footer />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") },
            { "@type": "ListItem", position: 2, name: "All tools", item: absoluteUrl("/tools") },
          ],
        }}
      />
      {/* Keeps the tool list in sync with the registry for crawlers that read ItemList. */}
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ItemList",
          itemListElement: tools.map((t, i) => ({
            "@type": "ListItem",
            position: i + 1,
            url: absoluteUrl(`/${t.slug}`),
            name: t.name,
          })),
        }}
      />
    </>
  );
}
