import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ToolGrid from "@/components/ToolGrid";
import JsonLd from "@/components/JsonLd";
import { absoluteUrl, site } from "@/lib/site";
import { getTool, toolsBySlug, type ToolSlug } from "@/lib/tools";

/**
 * Server-rendered shell for every tool page: the interactive workspace sits
 * on top, followed by crawlable, tool-specific content about what happens to
 * the file, limits, steps and related tools.
 */
export default function ToolPage({ slug, children }: { slug: ToolSlug; children: React.ReactNode }) {
  const tool = getTool(slug);
  const url = absoluteUrl(`/${tool.slug}`);
  const related = tool.related.map((s) => toolsBySlug[s]);

  return (
    <>
      <Header />
      <main id="main" className="min-h-screen">
        {children}

        <section
          aria-labelledby="file-handling"
          className="mx-auto max-w-4xl px-4 pb-6 sm:px-6"
        >
          <div className="card-chunky p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[0.8rem] bg-[var(--success-bg)]">
                <ShieldCheck size={20} className="text-[var(--success)]" aria-hidden="true" />
              </span>
              <h2 id="file-handling" className="font-display text-xl font-extrabold sm:text-2xl">
                What happens to your file
              </h2>
            </div>
            <ul className="mt-5 space-y-3 text-sm leading-6 text-[var(--fg)]">
              <li>
                <strong>It stays on your device.</strong> {tool.name} runs as JavaScript inside
                this browser tab. Your file is read from your computer or phone, processed in
                memory, and the result is handed straight back to you as a download. It is never
                uploaded to peedf or anyone else, and nothing is kept once you close the tab.
              </li>
              {tool.handling.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>

            <h3 className="font-display mt-7 text-base font-bold">Limits</h3>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-6 text-[var(--muted)]">
              <li>Up to {site.maxFileMb} MB per file.</li>
              {tool.limits.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
            <p className="mt-5 text-xs leading-5 text-[var(--muted)]">
              Read more about files and analytics in our{" "}
              <Link href="/privacy" className="font-semibold underline">
                privacy notice
              </Link>
              .
            </p>
          </div>
        </section>

        <section aria-labelledby="how-to" className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
          <h2 id="how-to" className="font-display text-2xl font-extrabold sm:text-3xl">
            How to use {tool.name}
          </h2>
          <ol className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {tool.steps.map((step, i) => (
              <li key={step} className="card-chunky p-5">
                <span className="btn btn-primary h-8 w-8 p-0 text-sm" aria-hidden="true">
                  {i + 1}
                </span>
                <p className="mt-3 text-sm leading-6">{step}</p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="related-tools" className="mx-auto max-w-4xl px-4 pb-16 pt-4 sm:px-6">
          <h2 id="related-tools" className="font-display text-2xl font-extrabold sm:text-3xl">
            Related tools
          </h2>
          <div className="mt-6">
            <ToolGrid items={related} />
          </div>
          <p className="mt-6 text-sm">
            <Link href="/tools" className="font-semibold underline">
              See all eight PDF tools
            </Link>
          </p>
        </section>
      </main>
      <Footer />

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "WebApplication",
              "@id": `${url}#app`,
              name: `${tool.name} by ${site.name}`,
              url,
              description: tool.metaDescription,
              applicationCategory: "UtilitiesApplication",
              operatingSystem: "Any",
              browserRequirements: "Requires a modern web browser with JavaScript enabled.",
              isAccessibleForFree: true,
              offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
              publisher: { "@type": "Organization", name: site.name, url: absoluteUrl("/") },
            },
            {
              "@type": "BreadcrumbList",
              itemListElement: [
                { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") },
                { "@type": "ListItem", position: 2, name: "All tools", item: absoluteUrl("/tools") },
                { "@type": "ListItem", position: 3, name: tool.name, item: url },
              ],
            },
          ],
        }}
      />
    </>
  );
}
