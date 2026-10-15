import Link from "next/link";
import { ArrowRight } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import HeroPrompt from "@/components/HeroPrompt";
import PromptChip from "@/components/PromptChip";
import { PROMPT_GROUPS, STATUS_LABEL } from "@/app/workspace/prompts";

const FACTS = [
  { label: "Every key point", value: "Cited" },
  { label: "Pages per document", value: "200" },
  { label: "Results deleted after", value: "24h" },
  { label: "Free in-browser tools", value: "8" },
];

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
        <div className="relative mx-auto max-w-5xl px-4 pb-20 pt-14 sm:px-6 sm:pb-28 sm:pt-20">
          <h1 className="max-w-4xl text-[3.4rem] leading-[0.95] sm:text-[6rem] md:text-[7.5rem]">
            Your PDFs. Your instructions. One AI workspace.
          </h1>
          <div className="mt-10 grid gap-8 md:mt-14 md:grid-cols-[1fr_1.1fr] md:items-end md:gap-12">
            <p className="max-w-sm text-lg leading-7 font-medium">
              Upload a PDF. Tell peedf what you need. Get it done, with every claim traced back to a page.
            </p>
            <HeroPrompt />
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link href="/workspace" className="btn btn-primary px-7 py-3.5 text-base">Open the workspace</Link>
            <a href="#how" className="btn btn-outline px-7 py-3.5 text-base">How it works</a>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 pb-16 sm:px-6 sm:pb-24">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {FACTS.map((f) => (
            <div key={f.label} className="flex min-h-44 flex-col justify-between rounded-[2rem] bg-[var(--accent)] p-5 sm:min-h-52 sm:p-6">
              <div className="text-sm font-medium text-[var(--accent-ink)]">{f.label}</div>
              <div className="font-display text-6xl text-white sm:text-7xl">{f.value}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 pb-16 sm:px-6 sm:pb-24">
        <div className="rounded-[2.5rem] bg-[var(--surface)] p-6 sm:p-12">
          <h2 className="max-w-2xl text-5xl sm:text-6xl">Ask for what you need</h2>
          <p className="mt-4 max-w-xl text-base leading-7 text-[var(--muted)]">
            Pick a starting point or write your own. Every request goes through the same workspace.
          </p>
          <div className="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2">
            {PROMPT_GROUPS.map((g) => (
              <div key={g.title}>
                <h3 className="text-2xl">{g.title}</h3>
                <div className="mt-1 text-sm text-[var(--muted)]">{STATUS_LABEL[g.status]}</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {g.prompts.map((p) => <PromptChip key={p} text={p} />)}
                </div>
              </div>
            ))}
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
          <div>
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
