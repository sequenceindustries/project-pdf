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
    "How peedf handles your files: single tools never upload them; the workspace processes them on our servers and deletes them after 24 hours. Plus server logs and consent-based analytics.",
});

const UPDATED = "15 October 2026";

export default function Privacy() {
  return (
    <>
      <Header />
      <main id="main" className="min-h-screen">
        <article className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
          <h1 className="font-display text-4xl font-extrabold sm:text-5xl">Privacy notice</h1>
          <p className="mt-3 text-sm text-[var(--muted)]">Last updated {UPDATED}</p>

          <div className="mt-10 space-y-10 text-base leading-7">
            <section aria-labelledby="summary">
              <h2 id="summary" className="font-display text-2xl font-extrabold">
                In short
              </h2>
              <ul className="mt-3 list-disc space-y-2 pl-5">
                <li>
                  <strong>Single tools</strong> (the pages under <Link href="/tools" className="underline">All tools</Link>)
                  run inside your browser. Your files never leave your device.
                </li>
                <li>
                  <strong>The workspace</strong> on the homepage uploads your files to Peedf so we can process your
                  instruction. Files, your instruction and results are deleted automatically after 24 hours.
                </li>
                <li>
                  <strong>AI tasks</strong> in the workspace send the text of your document to our AI provider to
                  produce the result.
                </li>
                <li>We don&apos;t sell your data, run ads, or use your documents to train AI models.</li>
              </ul>
            </section>

            <section aria-labelledby="tools">
              <h2 id="tools" className="font-display text-2xl font-extrabold">
                Single tools: processed on your device
              </h2>
              <p className="mt-3">
                Compress, Merge, Split, JPG to PDF, Watermark, Rotate, PDF to JPG and Password Protect run as
                JavaScript in your browser. Your browser reads the file, the tool processes it in memory, and the
                result is handed straight back to you as a download.
              </p>
              <ul className="mt-3 list-disc space-y-2 pl-5">
                <li>Files, their names and their contents are never uploaded to peedf or anyone else.</li>
                <li>Passwords and watermark text you type are used only inside your browser.</li>
                <li>Each file can be up to {site.maxFileMb} MB.</li>
              </ul>
            </section>

            <section aria-labelledby="workspace">
              <h2 id="workspace" className="font-display text-2xl font-extrabold">
                The workspace: processed on our servers
              </h2>
              <p className="mt-3">When you use the workspace, we receive:</p>
              <ul className="mt-3 list-disc space-y-2 pl-5">
                <li>the files you add (PDF, JPG or PNG; up to {site.maxFileMb} MB each, 10 per request);</li>
                <li>the instruction you type;</li>
                <li>a random identifier stored in a cookie, so only your browser can see your jobs.</li>
              </ul>
              <h3 className="font-display mt-6 text-lg font-bold">What we do with them</h3>
              <ul className="mt-3 list-disc space-y-2 pl-5">
                <li>
                  Files are stored in Peedf&apos;s own database, hosted by our provider Railway, and processed by our
                  servers in an isolated process with time and memory limits.
                </li>
                <li>
                  Results are available only to the browser that started the job. Download links are signed, tied to
                  that browser, and expire after 15 minutes (reopening the job gives you fresh links).
                </li>
                <li>
                  <strong>After 24 hours</strong> we delete the uploaded files, the results, your instruction and the
                  file names. We keep a content-free record (job status, timings, page counts, which tools ran) for
                  30 days for reliability and usage limits, then delete it.
                </li>
                <li>
                  Our logs record job ids, statuses, counts and durations. They do not record file names, file
                  contents, your instructions or AI output.
                </li>
                <li>We hash your IP address with a secret key to enforce rate limits. We don&apos;t store it in readable form.</li>
              </ul>
              <h3 id="ai" className="font-display mt-6 text-lg font-bold">
                AI tasks
              </h3>
              <ul className="mt-3 list-disc space-y-2 pl-5">
                <li>
                  To work out the steps, we send your instruction plus each file&apos;s name, type and page count to our AI
                  provider. Document text is not sent for this step.
                </li>
                <li>
                  For summaries, questions, explanations, comparisons and extraction, we also send the text extracted
                  from your document. Simple PDF edits (remove, merge, rotate, compress, convert) don&apos;t send any
                  document text to an AI provider.
                </li>
                <li>
                  Our AI provider is Anthropic, which processes this data to generate the result under its commercial
                  API terms. We don&apos;t use your documents to train AI models.
                </li>
                <li>
                  AI results can be wrong. Peedf checks each quoted excerpt against your document and marks anything
                  it can&apos;t match as unverified. Always check important details against the original.
                </li>
              </ul>
            </section>

            <section aria-labelledby="logs">
              <h2 id="logs" className="font-display text-2xl font-extrabold">
                Basic server logs
              </h2>
              <p className="mt-3">
                Our hosting provider (Railway) records standard request logs: the address requested, time, response
                status, IP address and browser user-agent. These logs keep the site running and secure. Fonts are
                served from peedf.com itself, not from a third-party font service.
              </p>
            </section>

            <section aria-labelledby="analytics">
              <h2 id="analytics" className="font-display text-2xl font-extrabold">
                Analytics (only if you allow it)
              </h2>
              <p className="mt-3">
                We use Google Analytics 4 to understand which tools people use, but only after you choose{" "}
                <strong>Allow</strong> in the banner. If you choose <strong>No thanks</strong>, or make no choice, the
                Google Analytics script is not loaded and no analytics cookies are set.
              </p>
              <p className="mt-3">If you allow analytics, Google Analytics receives:</p>
              <ul className="mt-3 list-disc space-y-2 pl-5">
                <li>Page views: the page address, referring page, and general device and browser information.</li>
                <li>
                  Tool usage events, such as a file being added or a task finishing. These include only the tool
                  name, the option you picked (for example a compression level), and rough ranges for file size,
                  page count and processing time (for example “1–5 MB”).
                </li>
              </ul>
              <p className="mt-3">
                File names, file contents, page text, instructions, passwords and watermark text are never sent to
                Google. Google signals and ad personalisation are switched off. Google Analytics sets first-party
                cookies (<code>_ga</code> and <code>_ga_*</code>) to tell visits apart.
              </p>
              <p className="mt-3">
                You can change your choice at any time: <ConsentSettingsButton className="font-semibold underline" />.
              </p>
            </section>

            <section aria-labelledby="operator">
              <h2 id="operator" className="font-display text-2xl font-extrabold">
                Who runs peedf
              </h2>
              <p className="mt-3">
                peedf.com is operated by {site.publisher}. We don&apos;t sell personal information and we don&apos;t
                run advertising on peedf.
              </p>
            </section>
          </div>

          <p className="mt-12 text-sm">
            <Link href="/" className="font-semibold underline">
              Back to the workspace
            </Link>
          </p>
        </article>
      </main>
      <Footer />
    </>
  );
}
