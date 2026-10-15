import Link from "next/link";
import { ArrowRight } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Workspace from "@/app/workspace/workspace";

const STEPS = [
  { title: "Upload a PDF", body: "Drop it in or browse. Text-based PDFs up to 20 MB." },
  { title: "Say what you need", body: "Plain language: a summary, an answer, every date and amount." },
  { title: "Get a checked result", body: "Key points come with page numbers and the exact quote, so you can verify them." },
];

export default function Home() {
  return (
    <main className="min-h-screen">
      <Header />

      <section className="relative overflow-hidden">
        <div aria-hidden className="halftone pointer-events-none absolute inset-x-0 bottom-0 h-2/3" />
        <div className="relative mx-auto grid max-w-5xl gap-8 px-4 pb-16 pt-10 sm:px-6 sm:pb-24 sm:pt-14 md:grid-cols-[1.05fr_1fr] md:items-start md:gap-10">
          <div className="min-w-0">
            <h1 className="text-[3.4rem] leading-[0.95] sm:text-[5rem] md:text-[5.5rem]">
              Your PDFs. Your instructions. One AI workspace.
            </h1>
            <p className="mt-6 max-w-sm text-lg font-medium leading-7">
              Upload a PDF. Tell peedf what you need. Get it done, with every claim traced back to a page.
            </p>
          </div>
          <div className="min-w-0 overflow-hidden rounded-[2rem] bg-[var(--surface)] p-4 sm:p-6 md:sticky md:top-24">
            <Workspace />
          </div>
        </div>
      </section>

      <section id="how" className="mx-auto max-w-5xl scroll-mt-24 px-4 pb-16 sm:px-6 sm:pb-24">
        <h2 className="text-5xl sm:text-6xl">How it works</h2>
        <ol className="mt-10 grid gap-8 md:grid-cols-3 md:gap-0">
          {STEPS.map((s, i) => (
            <li key={s.title} className={`md:pr-8 ${i > 0 ? "md:dotted-l md:pl-8" : ""}`}>
              <div className="text-sm font-bold text-[var(--accent-dark)]">Step {i + 1}</div>
              <h3 className="mt-2 text-3xl">{s.title}</h3>
              <p className="mt-3 max-w-xs text-base leading-7 text-[var(--muted)]">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto max-w-5xl px-4 pb-16 sm:px-6 sm:pb-24">
        <div className="grid gap-8 rounded-[2.5rem] bg-[var(--fg)] p-6 text-white sm:p-12 md:grid-cols-2">
          <h2 className="text-5xl sm:text-6xl">What happens to your file</h2>
          <ul className="space-y-4 text-base leading-7 text-[var(--dark-muted)]">
            <li>AI jobs upload your PDF to peedf. We extract its text and discard the file straight away.</li>
            <li>The text is sent to an AI provider to answer your request, then deleted from peedf when the job ends.</li>
            <li>Results are kept for 24 hours, then deleted. Only the browser that ran the job can open them.</li>
            <li>AI can miss things. For contracts and financials, check the cited pages.</li>
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 pb-20 sm:px-6 sm:pb-28">
        <Link href="/tools" className="group flex flex-col gap-6 rounded-[2.5rem] border-[1.5px] border-dotted border-[var(--fg)] p-6 transition-colors hover:bg-[var(--surface)] sm:flex-row sm:items-center sm:justify-between sm:p-10">
          <div className="min-w-0">
            <h2 className="text-4xl sm:text-5xl">Just need a quick tool?</h2>
            <p className="mt-3 max-w-md text-base leading-7 text-[var(--muted)]">
              Merge, split, compress, rotate, watermark, protect and convert. Free, and your file never leaves your browser.
            </p>
          </div>
          <span className="btn btn-dark shrink-0 gap-2 px-7 py-3.5 text-base">
            Browse the free tools <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
          </span>
        </Link>
      </section>

      <Footer />
    </main>
  );
}
