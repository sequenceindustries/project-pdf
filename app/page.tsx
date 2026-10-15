import type { Metadata } from "next";
import Link from "next/link";
import { Sparkles, ShieldCheck, HardDrive, EyeOff } from "lucide-react";
import Header from "@/components/Header";
import ToolGrid from "@/components/ToolGrid";
import Footer from "@/components/Footer";
import PdfStack from "@/components/PdfStack";
import JsonLd from "@/components/JsonLd";
import { pageMetadata } from "@/lib/seo";
import { absoluteUrl, site } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  path: "/",
  title: "peedf — PDFs, without the headache",
  absoluteTitle: true,
  description:
    "Simple PDF tools that work right in your browser: compress, merge, split, rotate, watermark, password-protect and convert to and from JPG. Files stay on your device.",
});

export default function Home() {
  return (
    <>
      <Header />
      <main id="main" className="min-h-screen">
        <section className="mx-auto grid max-w-5xl grid-cols-1 items-center gap-10 px-4 pb-16 pt-14 sm:px-6 sm:pb-24 sm:pt-20 md:grid-cols-2 md:gap-6">
          <div className="text-center md:text-left">
            <h1 className="font-display mx-auto max-w-md text-5xl font-extrabold leading-[1.05] sm:text-6xl md:mx-0">
              PDFs, without the headache.
            </h1>
            <p className="mx-auto mt-5 max-w-sm text-base leading-7 text-[var(--muted)] sm:text-lg md:mx-0">
              Simple tools for merging, splitting, compressing, converting and managing your PDFs.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3 md:justify-start">
              <a href="#tools" className="btn btn-primary px-7 py-3.5 text-base">
                Choose a tool
              </a>
              <a href="#how" className="btn btn-outline px-7 py-3.5 text-base">
                How it works
              </a>
            </div>
          </div>
          <PdfStack />
        </section>

        <section id="tools" aria-labelledby="tools-heading" className="mx-auto max-w-5xl scroll-mt-24 px-4 py-16 sm:px-6 sm:py-20">
          <h2 id="tools-heading" className="sr-only">
            PDF tools
          </h2>
          <ToolGrid />
        </section>

        <section id="how" aria-labelledby="how-heading" className="mx-auto max-w-5xl scroll-mt-24 px-4 py-16 sm:px-6 sm:py-20">
          <h2 id="how-heading" className="font-display text-center text-3xl font-extrabold sm:text-4xl">
            How it works
          </h2>
          <ol className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              { step: "1", title: "Drop a file", body: "Drag your PDF or image in, or click to browse." },
              { step: "2", title: "Pick a tool", body: "Merge, split, compress, convert — whatever you need." },
              { step: "3", title: "Download", body: "Your file never leaves the browser. Nothing is uploaded." },
            ].map((s) => (
              <li key={s.step} className="card-chunky p-6 text-center">
                <div className="btn btn-primary mx-auto h-9 w-9 p-0 text-sm" aria-hidden="true">
                  {s.step}
                </div>
                <h3 className="font-display mt-4 text-lg font-bold">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-6 text-[var(--muted)]">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="local-heading" className="mx-auto max-w-5xl px-4 pb-16 sm:px-6 sm:pb-24">
          <div className="card-chunky p-6 sm:p-10">
            <h2 id="local-heading" className="font-display text-2xl font-extrabold sm:text-3xl">
              Your files stay on your device
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)] sm:text-base sm:leading-7">
              Most online PDF sites upload your document to their servers. peedf doesn&apos;t. Each
              tool is a small program that runs inside your browser tab, so the work happens on your
              own computer or phone.
            </p>
            <ul className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-3">
              <li className="flex gap-3">
                <HardDrive className="mt-0.5 shrink-0 text-[var(--accent-dark)]" size={20} aria-hidden="true" />
                <div>
                  <h3 className="font-display text-base font-bold">Processed locally</h3>
                  <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                    Files are read, changed and saved in your browser&apos;s memory. No upload, no
                    waiting for a server.
                  </p>
                </div>
              </li>
              <li className="flex gap-3">
                <EyeOff className="mt-0.5 shrink-0 text-[var(--accent-dark)]" size={20} aria-hidden="true" />
                <div>
                  <h3 className="font-display text-base font-bold">Nothing kept</h3>
                  <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                    We never receive your files, so there is nothing to store or delete. Close the
                    tab and it&apos;s gone.
                  </p>
                </div>
              </li>
              <li className="flex gap-3">
                <ShieldCheck className="mt-0.5 shrink-0 text-[var(--accent-dark)]" size={20} aria-hidden="true" />
                <div>
                  <h3 className="font-display text-base font-bold">Up to {site.maxFileMb} MB per file</h3>
                  <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                    Because your device does the work, very large files are limited to keep tools
                    fast and stable.
                  </p>
                </div>
              </li>
            </ul>
            <p className="mt-8 text-sm">
              <Link href="/privacy" className="font-semibold underline">
                Read the privacy notice
              </Link>
            </p>
          </div>
        </section>

        <section className="bg-[var(--dark-bg)] px-4 py-20 text-white sm:px-6 sm:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <div
              className="chip mx-auto w-fit bg-[var(--dark-surface)] px-3.5 py-1.5 text-[var(--dark-muted)]"
              style={{ borderColor: "var(--dark-border)" }}
            >
              <Sparkles size={13} aria-hidden="true" />
              Coming next
            </div>
            <h2 className="font-display mt-6 text-3xl font-extrabold leading-tight sm:text-4xl md:text-5xl">
              From file tools to a document
              <br className="hidden sm:block" /> you can talk to.
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-[var(--dark-muted)] sm:text-lg">
              OCR, page-level editing and AI document chat are on the roadmap. Before any of them
              ship, we&apos;ll spell out exactly how each one handles your files.
            </p>
          </div>
        </section>
      </main>
      <Footer />

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              "@id": `${site.url}/#organization`,
              name: site.name,
              url: absoluteUrl("/"),
              logo: absoluteUrl("/icon.svg"),
            },
            {
              "@type": "WebSite",
              "@id": `${site.url}/#website`,
              name: site.name,
              url: absoluteUrl("/"),
              description: site.description,
              inLanguage: "en",
              publisher: { "@id": `${site.url}/#organization` },
            },
          ],
        }}
      />
    </>
  );
}
