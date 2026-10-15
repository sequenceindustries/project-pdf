import type { Metadata } from "next";
import Link from "next/link";
import { HardDrive, Server, Upload, MessageSquareText, Cog, ShieldCheck, Download } from "lucide-react";
import Header from "@/components/Header";
import ToolGrid from "@/components/ToolGrid";
import Footer from "@/components/Footer";
import JsonLd from "@/components/JsonLd";
import Workspace, { ExampleGroups } from "@/components/workspace/Workspace";
import { pageMetadata } from "@/lib/seo";
import { absoluteUrl, site } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  path: "/",
  title: "peedf — Your PDFs. Your instructions. One workspace.",
  absoluteTitle: true,
  description:
    "Upload a PDF and say what you need in plain words: remove pages, merge, rotate, compress, convert, summarise or extract details. Peedf does the work and hands back the files.",
});

const steps = [
  { Icon: Upload, title: "Upload", body: "Drop in one or more PDFs or images." },
  { Icon: MessageSquareText, title: "Instruct", body: "Say what you need, in plain words." },
  { Icon: Cog, title: "Process", body: "Peedf plans the steps and runs real PDF tools." },
  { Icon: ShieldCheck, title: "Verify", body: "Every output is re-opened and checked. AI quotes are matched to the source." },
  { Icon: Download, title: "Download", body: "Get your files. They're deleted after 24 hours." },
];

export default function Home() {
  return (
    <>
      <Header />
      <main id="main" className="min-h-screen">
        <section id="workspace" className="mx-auto max-w-3xl scroll-mt-24 px-4 pb-14 pt-10 sm:px-6 sm:pb-20 sm:pt-16">
          <div className="text-center">
            <h1 className="font-display mx-auto max-w-2xl text-4xl font-extrabold leading-[1.05] sm:text-6xl">
              Your PDFs. Your instructions. One workspace.
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-[var(--muted)] sm:text-lg">
              Upload a PDF. Tell Peedf what you need. Get it done.
            </p>
          </div>
          <div className="mt-8 sm:mt-10">
            <Workspace />
          </div>
        </section>

        <section aria-labelledby="examples-heading" className="mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-20">
          <h2 id="examples-heading" className="font-display text-center text-3xl font-extrabold sm:text-4xl">
            Things you can ask
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-[var(--muted)]">
            Pick one to drop it into the box above, then edit it to fit your file.
          </p>
          <div className="mt-10">
            <ExampleGroups />
          </div>
        </section>

        <section id="how" aria-labelledby="how-heading" className="mx-auto max-w-5xl scroll-mt-24 px-4 py-14 sm:px-6 sm:py-20">
          <h2 id="how-heading" className="font-display text-center text-3xl font-extrabold sm:text-4xl">
            How it works
          </h2>
          <ol className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {steps.map(({ Icon, title, body }, i) => (
              <li key={title} className="card-chunky p-5">
                <div className="flex items-center gap-2">
                  <span className="btn btn-primary h-8 w-8 p-0 text-sm" aria-hidden="true">
                    {i + 1}
                  </span>
                  <Icon size={18} className="text-[var(--accent-dark)]" aria-hidden="true" />
                </div>
                <h3 className="font-display mt-3 text-lg font-bold">{title}</h3>
                <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="files-heading" className="mx-auto max-w-5xl px-4 pb-14 sm:px-6 sm:pb-20">
          <div className="card-chunky p-6 sm:p-10">
            <h2 id="files-heading" className="font-display text-2xl font-extrabold sm:text-3xl">
              Where your files go
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)] sm:text-base sm:leading-7">
              Peedf has two ways to work, and they handle files differently.
            </p>
            <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="flex gap-3">
                <Server className="mt-0.5 shrink-0 text-[var(--accent-dark)]" size={22} aria-hidden="true" />
                <div>
                  <h3 className="font-display text-lg font-bold">The workspace</h3>
                  <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-6 text-[var(--muted)]">
                    <li>Your files are uploaded to Peedf and processed on our servers.</li>
                    <li>Files, your instruction and results are deleted automatically after 24 hours.</li>
                    <li>Only you can see your jobs: they&apos;re tied to your browser, and download links expire.</li>
                    <li>AI tasks (summaries, questions, extraction) send the document&apos;s text to our AI provider to produce the result.</li>
                    <li>Up to {site.maxFileMb} MB per file, 10 files per request.</li>
                  </ul>
                </div>
              </div>
              <div className="flex gap-3">
                <HardDrive className="mt-0.5 shrink-0 text-[var(--success)]" size={22} aria-hidden="true" />
                <div>
                  <h3 className="font-display text-lg font-bold">Single tools</h3>
                  <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-6 text-[var(--muted)]">
                    <li>Each tool below runs entirely inside your browser tab.</li>
                    <li>Your file never leaves your device and is never uploaded.</li>
                    <li>Best for sensitive files when you know exactly which tool you need.</li>
                  </ul>
                </div>
              </div>
            </div>
            <p className="mt-8 text-sm">
              <Link href="/privacy" className="font-semibold underline">
                Read the full privacy notice
              </Link>
            </p>
          </div>
        </section>

        <section id="tools" aria-labelledby="tools-heading" className="mx-auto max-w-5xl scroll-mt-24 px-4 pb-16 sm:px-6 sm:pb-24">
          <h2 id="tools-heading" className="font-display text-3xl font-extrabold sm:text-4xl">
            Prefer a single tool?
          </h2>
          <p className="mt-3 text-[var(--muted)]">These run entirely on your device. Nothing is uploaded.</p>
          <div className="mt-8">
            <ToolGrid />
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
