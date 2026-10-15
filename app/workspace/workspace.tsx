"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Download, FileText, Loader2, Sparkles, X, CheckCircle2, AlertTriangle, Circle } from "lucide-react";
import Dropzone from "@/components/Dropzone";
import { isPdf } from "@/lib/pdf-utils";
import { PROMPT_GROUPS, STATUS_LABEL } from "./prompts";

const MAX_AI_BYTES = 20 * 1024 * 1024;
const STORE = "peedf.job";
const QUICK = ["Summarise this document", "What are the key risks?", "List every date and amount"];

type Point = { text: string; pages: number[]; quote: string; verified: boolean };
type Result = { headline: string; summary: string; answer: string | null; points: Point[]; uncertainties: string[]; sensitive: boolean };
type Job = {
  id: string;
  status: "uploading" | "queued" | "processing" | "validating" | "completed" | "failed" | "cancelled";
  filename: string;
  pageCount: number;
  instruction: string;
  result: Result | null;
  error: { code: string; message: string } | null;
};
type Problem = { message: string; tool?: { name: string; href: string } };

const STEPS = ["Queued", "Processing", "Validating", "Completed"] as const;
const STEP_OF: Record<string, number> = { uploading: -1, queued: 0, processing: 1, validating: 2, completed: 3 };

export default function Workspace() {
  const [file, setFile] = useState<File | null>(null);
  const [instruction, setInstruction] = useState("");
  const [job, setJob] = useState<Job | null>(null);
  const [uploading, setUploading] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const tokenRef = useRef("");
  const armed = useRef(false); // instruction chosen from a suggestion; run as soon as a PDF arrives
  const [tick, setTick] = useState(0);

  const poll = useCallback(async (id: string) => {
    const res = await fetch(`/api/jobs/${id}`, { headers: { "x-job-token": tokenRef.current }, cache: "no-store" });
    if (res.status === 404) {
      try { localStorage.removeItem(STORE); } catch {}
      setJob(null);
      setProblem({ message: "That job has expired or no longer exists. Upload the PDF again to re-run it." });
      return;
    }
    if (res.ok) setJob(await res.json());
  }, []);

  // Resume after refresh.
  useEffect(() => {
    try {

      const s = JSON.parse(localStorage.getItem(STORE) || "null");
      if (s?.id && s?.token) {
        tokenRef.current = s.token;
        void poll(s.id);
      }
    } catch {}
  }, [poll]);

  const active = job && ["queued", "processing", "validating", "uploading"].includes(job.status);
  useEffect(() => {
    if (!active || !job) return;
    const t = setTimeout(() => { void poll(job.id); setTick((x) => x + 1); }, 2000);
    return () => clearTimeout(t);
  }, [active, job, poll, tick]);

  function pick(files: File[]) {
    setProblem(null);
    const f = files[0];
    if (!f) return;
    if (!isPdf(f)) return setProblem({ message: "Please choose a PDF file." });
    if (f.size > MAX_AI_BYTES) return setProblem({ message: "That file is over the 20 MB limit for AI analysis. Try Split or Compress first.", tool: { name: "Compress PDF", href: "/compress" } });
    setFile(f);
    if (armed.current && instruction.trim().length >= 3) {
      armed.current = false;
      void submit(instruction, f);
    }
  }

  async function submit(text = instruction, f: File | null = file) {
    if (!f) return setProblem({ message: "Add a PDF first." });
    if (text.trim().length < 3) return setProblem({ message: "Tell peedf what you need, or pick a suggestion below." });
    setProblem(null);
    setUploading(true);
    setJob({ id: "", status: "uploading", filename: f.name, pageCount: 0, instruction: text, result: null, error: null });
    try {
      const fd = new FormData();
      fd.append("file", f);
      fd.append("instruction", text);
      const res = await fetch("/api/jobs", { method: "POST", body: fd });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setJob(null);
        return setProblem({ message: body?.error?.message ?? "Upload failed. Please try again.", tool: body?.tool });
      }
      tokenRef.current = body.token;
      try { localStorage.setItem(STORE, JSON.stringify({ id: body.id, token: body.token })); } catch {}
      await poll(body.id);
    } catch {
      setJob(null);
      setProblem({ message: "Couldn't reach peedf. Check your connection and try again." });
    } finally {
      setUploading(false);
    }
  }

  function choose(p: string) {
    setProblem(null);
    setInstruction(p);
    if (file) void submit(p, file);
    else armed.current = true;
  }

  async function cancel() {
    if (!job) return;
    await fetch(`/api/jobs/${job.id}/cancel`, { method: "POST", headers: { "x-job-token": tokenRef.current } });
    await poll(job.id);
  }

  async function download() {
    if (!job) return;
    const res = await fetch(`/api/jobs/${job.id}/download`, { headers: { "x-job-token": tokenRef.current } });
    if (!res.ok) return setProblem({ message: "Couldn't download the result. It may have expired." });
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement("a");
    a.href = url;
    a.download = job.filename.replace(/\.pdf$/i, "") + "-peedf.md";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function reset() {
    try { localStorage.removeItem(STORE); } catch {}
    setJob(null); setFile(null); setProblem(null); setInstruction("");
  }

  const r = job?.result;
  const inner = (
      <>
        {!job && (
          <>
            {!file ? (
              <Dropzone accept="application/pdf,.pdf" compact onFiles={pick} title="Drop a PDF here" subtitle="or click to browse · text-based PDFs up to 20 MB" icon={Sparkles} />
            ) : (
              <div className="card-chunky flex items-center gap-3 bg-[var(--surface-soft)] p-4">
                <FileText size={20} className="shrink-0 text-[var(--muted)]" />
                <div className="min-w-0 flex-1 truncate text-sm font-medium">{file.name}</div>
                <button onClick={() => setFile(null)} className="text-sm text-[var(--muted)] underline">Change</button>
              </div>
            )}

            <label htmlFor="instr" className="mt-6 block text-sm font-bold">What do you need?</label>
            <textarea
              id="instr"
              value={instruction}
              onChange={(e) => { armed.current = false; setInstruction(e.target.value); }}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && file) { e.preventDefault(); void submit(); } }}
              maxLength={1000}
              rows={3}
              placeholder="e.g. Summarise this contract and list the deadlines"
              className="mt-2 w-full rounded-xl border-[1.5px] border-dotted border-[var(--fg)] bg-transparent px-4 py-3 text-sm outline-none focus:border-solid"
            />
            <button onClick={() => submit()} disabled={uploading} className="mt-4 w-full btn btn-primary px-5 py-3.5 disabled:opacity-40">
              {uploading ? <Loader2 className="mx-auto animate-spin" /> : <><Sparkles className="mr-2 inline" size={17} />Do it</>}
            </button>

            <div className="mt-5">
              <div className="flex flex-wrap gap-2">
                {QUICK.map((p) => (
                  <button key={p} onClick={() => choose(p)} className="chip cursor-pointer hover:bg-[var(--surface-soft)]">{p}</button>
                ))}
              </div>
              <details className="mt-4 text-sm">
                <summary className="cursor-pointer font-medium">More ideas</summary>
                <div className="mt-4 space-y-4">
                  {PROMPT_GROUPS.map((g) => (
                    <div key={g.title}>
                      <div className="font-bold">{g.title} <span className="font-normal text-[var(--muted)]">· {STATUS_LABEL[g.status]}</span></div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {g.prompts.map((p) => (
                          <button key={p} onClick={() => choose(p)} className="chip cursor-pointer hover:bg-[var(--surface-soft)]">{p}</button>
                        ))}
                      </div>
                    </div>
                  ))}
                  <p className="text-xs text-[var(--muted)]">
                    Today peedf can summarise, answer questions about and extract facts from text-based PDFs. File edits are handed to the in-browser tools; translation, comparison and OCR are coming.
                  </p>
                </div>
              </details>
            </div>
          </>
        )}

        {job && (
          <div className="card-chunky bg-[var(--surface-soft)] p-5 sm:p-6">
            <div className="flex items-center gap-3 border-b border-[var(--border)] pb-4">
              <FileText size={20} className="shrink-0 text-[var(--muted)]" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{job.filename}</div>
                <div className="truncate text-xs text-[var(--muted)]">{job.instruction}</div>
              </div>
              {active && job.id && <button onClick={cancel} className="text-sm text-[var(--muted)] underline">Cancel</button>}
            </div>

            {job.status === "uploading" && <p className="mt-4 text-sm"><Loader2 className="mr-2 inline animate-spin" size={16} />Uploading…</p>}
            {(["queued", "processing", "validating", "completed"] as const).includes(job.status as never) && (
              <ol className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm" aria-label="Job progress">
                {STEPS.map((s, i) => {
                  const cur = STEP_OF[job.status];
                  const done = i < cur || job.status === "completed";
                  return (
                    <li key={s} className={`flex items-center gap-1.5 ${done || i === cur ? "font-bold" : "text-[var(--muted)]"}`}>
                      {done ? <CheckCircle2 size={16} className="text-[var(--accent)]" /> : i === cur ? <Loader2 size={16} className="animate-spin" /> : <Circle size={16} />}
                      {s}
                    </li>
                  );
                })}
              </ol>
            )}
            {job.status === "cancelled" && <p className="mt-4 text-sm">Cancelled.</p>}
            {job.status === "failed" && (
              <p className="mt-4 flex gap-2 text-sm text-red-700"><AlertTriangle size={16} className="mt-0.5 shrink-0" />{job.error?.message ?? "Something went wrong."}</p>
            )}

            {r && job.status === "completed" && (
              <article className="mt-5">
                <h2 className="font-display text-2xl font-extrabold">{r.headline}</h2>
                {r.answer && (<><h3 className="mt-4 text-sm font-bold">Answer</h3><p className="mt-1 whitespace-pre-wrap text-sm">{r.answer}</p></>)}
                <h3 className="mt-4 text-sm font-bold">Summary <span className="font-normal text-[var(--muted)]">· AI interpretation</span></h3>
                <p className="mt-1 whitespace-pre-wrap text-sm">{r.summary}</p>
                <h3 className="mt-4 text-sm font-bold">Key points <span className="font-normal text-[var(--muted)]">· with source pages</span></h3>
                <ul className="mt-2 space-y-3 text-sm">
                  {r.points.map((p, i) => (
                    <li key={i}>
                      {p.text} <span className="chip">p. {p.pages.join(", ")}</span>
                      <blockquote className="mt-1 border-l-2 border-[var(--border)] pl-3 text-xs text-[var(--muted)]">“{p.quote}”{!p.verified && <span className="ml-1 font-bold text-amber-700"> · quote not matched, check the source</span>}</blockquote>
                    </li>
                  ))}
                </ul>
                {r.uncertainties.length > 0 && (<><h3 className="mt-4 text-sm font-bold">Uncertainties</h3><ul className="mt-1 list-disc pl-5 text-sm">{r.uncertainties.map((u, i) => <li key={i}>{u}</li>)}</ul></>)}
                <p className="mt-5 rounded-xl border border-[var(--border)] bg-white p-3 text-xs text-[var(--muted)]">
                  {r.sensitive ? "This looks like financial or contractual material. AI can miss or misread terms, so verify against the cited pages and consult a qualified professional before relying on it." : "Generated by AI. Quotes are copied from your document; the summary is interpretation. Check the cited pages for anything important."}
                </p>
                <button onClick={download} className="mt-5 w-full btn btn-primary px-5 py-3.5"><Download className="mr-2 inline" size={17} />Download result (.md)</button>
              </article>
            )}

            {!active && <button onClick={reset} className="mt-4 w-full btn btn-outline px-5 py-3">{job.status === "failed" ? "Try again" : "Start a new job"}</button>}
          </div>
        )}

        {problem && (
          <div role="alert" className="mt-4 rounded-2xl border-[1.5px] border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {problem.message}
            {problem.tool && <Link href={problem.tool.href} className="ml-2 font-bold underline">Open {problem.tool.name}</Link>}
            <button onClick={() => setProblem(null)} aria-label="Dismiss" className="float-right"><X size={16} /></button>
          </div>
        )}
        <p className="mt-8 text-center text-xs text-[var(--muted)]">
          AI jobs upload the PDF&apos;s text to peedf and an AI provider to be processed. The PDF file itself is discarded after text extraction; results are kept for a limited time, then deleted. The other peedf tools never upload your files.
        </p>
      </>
  );

  return <div id="workspace" className="scroll-mt-24">{inner}</div>;
}
