import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { ConsentSettingsButton } from "@/components/Analytics";
import { pageMetadata } from "@/lib/seo";
import { site } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  path: "/privacy",
  title: "Privacy notice",
  description:
    "How peedf handles your files (they never leave your device), what basic server logs exist, and how optional, consent-based Google Analytics works.",
});

const UPDATED = "8 October 2026";

export default function Privacy() {
  return (
    <>
      <Header />
      <main id="main" className="min-h-screen">
        <article className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
          <h1 className="font-display text-4xl font-extrabold sm:text-5xl">Privacy notice</h1>
          <p className="mt-3 text-sm text-[var(--muted)]">Last updated {UPDATED}</p>

          <div className="mt-10 space-y-10 text-base leading-7">
            <section aria-labelledby="files">
              <h2 id="files" className="font-display text-2xl font-extrabold">
                Your files
              </h2>
              <p className="mt-3">
                Every peedf tool runs as JavaScript inside your browser. When you choose a file, your
                browser reads it from your device and the tool processes it in memory. The result is
                created on your device and handed to you as a download.
              </p>
              <ul className="mt-3 list-disc space-y-2 pl-5">
                <li>Your files, their names and their contents are never uploaded to peedf or to anyone else.</li>
                <li>We don&apos;t store files, because we never receive them. Closing the tab clears them from memory.</li>
                <li>
                  Passwords typed into Password Protect PDF and text typed into Watermark PDF are used
                  only inside your browser and are never sent anywhere.
                </li>
                <li>Each file can be up to {site.maxFileMb} MB, because your own device does the processing.</li>
              </ul>
            </section>

            <section aria-labelledby="logs">
              <h2 id="logs" className="font-display text-2xl font-extrabold">
                Basic server logs
              </h2>
              <p className="mt-3">
                Like any website, the pages, scripts and fonts that make up peedf are delivered by our
                hosting provider (Railway). To do that, it records standard request logs: the address
                requested, time, response status, IP address and browser user-agent. These logs are
                used to keep the site running and secure. They never include your files.
              </p>
              <p className="mt-3">
                Fonts are served from peedf.com itself, not from a third-party font service.
              </p>
            </section>

            <section aria-labelledby="analytics">
              <h2 id="analytics" className="font-display text-2xl font-extrabold">
                Analytics (only if you allow it)
              </h2>
              <p className="mt-3">
                We use Google Analytics 4 to understand which tools people use, but only after you
                choose <strong>Allow</strong> in the banner. If you choose <strong>No thanks</strong>,
                or make no choice, the Google Analytics script is not loaded and no analytics cookies
                are set.
              </p>
              <p className="mt-3">If you allow analytics, Google Analytics receives:</p>
              <ul className="mt-3 list-disc space-y-2 pl-5">
                <li>Page views: the page address, referring page, and general device and browser information.</li>
                <li>
                  Tool usage events, such as a file being added or a tool finishing. These include
                  only the tool name, the option you picked (for example a compression level or
                  rotation angle), and rough ranges for file size, page count and processing time
                  (for example “1–5 MB”).
                </li>
              </ul>
              <p className="mt-3">
                File names, file contents, page text, passwords and watermark text are never sent.
                Google signals and ad personalisation are switched off. Google Analytics sets
                first-party cookies (<code>_ga</code> and <code>_ga_*</code>) to tell visits apart.
              </p>
              <p className="mt-3">
                You can change your choice at any time:{" "}
                <ConsentSettingsButton className="font-semibold underline" />.
              </p>
            </section>

            <section aria-labelledby="operator">
              <h2 id="operator" className="font-display text-2xl font-extrabold">
                Who runs peedf
              </h2>
              <p className="mt-3">
                peedf.com is operated by {site.publisher}. We don&apos;t sell personal information and
                we don&apos;t run advertising on peedf.
              </p>
            </section>
          </div>

          <p className="mt-12 text-sm">
            <Link href="/tools" className="font-semibold underline">
              Back to all PDF tools
            </Link>
          </p>
        </article>
      </main>
      <Footer />
    </>
  );
}
