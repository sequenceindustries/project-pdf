"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  CircleAlert,
  Download,
  ExternalLink,
  FileImage,
  FileText,
  Loader2,
  RotateCcw,
  Send,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import Markdown from "./Markdown";
import { exampleGroups, type Example } from "@/lib/examples";
import { ACTIVE, type Analysis, type JobView, type PlanStep } from "@/lib/workspace-types";
import { sizeBand, track } from "@/lib/analytics";

const MAX_FILES = 10;
const MAX_FILE_MB = 50;
const MAX_TOTAL_MB = 100;
const STORAGE_KEY = "peedf-last-job";

type Phase = { kind: "compose" } | { kind: "uploading"; pct: number } | { kind: "job"; id: string };

function fmtSize(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
}

function isAccepted(f: File) {
  return /\.(pdf|jpe?g|png)$/i.test(f.name) || ["application/pdf", "image/jpeg", "image/png"].includes(f.type);
}

const STEP_LABEL: Record<string, (s: PlanStep) => string> = {
  merge: () => "Merge files",
  extract_pages: (s) => `Keep pages ${s.pages}`,
  remove_pages: (s) => `Remove pages ${s.pages}`,
  reorder_pages: (s) => (s.order === "reverse" ? "Reverse page order" : `Reorder pages: ${s.order}`),
  rotate: (s) => `Rotate ${s.pages ? `pages ${s.pages}` : "all pages"} ${s.angle === 270 ? "left" : s.angle === 180 ? "180°" : "right"}`,
  compress: (s) => `Compress (${s.level})`,
  images_to_pdf: () => "Images → PDF",
  pdf_to_images: (s) => `PDF → JPG${s.pages ? ` (pages ${s.pages})` : ""}`,
  extract_text: () => "Extract text",
  analyze: (s) =>
    ({ summary: "AI summary", answer: "AI answer", explain: "AI explanation", extract: "AI extraction", compare: "AI comparison" })[
      String(s.mode)
    ] ?? "AI analysis",
};

const STATUS_TEXT: Record<JobView["status"], string> = {
  queued: "Queued",
  processing: "Processing",
  validating: "Checking results",
  completed: "Done",
  failed: "Couldn't finish",
  cancelled: "Cancelled",
  needs_input: "Needs your input",
};

export default function Workspace() {
  const [files, setFiles] = useState<File[]>([]);
  const [instruction, setInstruction] = useState("");
  const [phase, setPhase] = useState<Phase>({ kind: "compose" });
  const [job, setJob] = useState<JobView | null>(null);
  const [error, setError] = useState("");
  const [aiOn, setAiOn] = useState<boolean | null>(null);
  const [over, setOver] = useState(false);
  const inputId = useId();
  const textRef = useRef<HTMLTextAreaElement>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  // Capabilities (is AI switched on?) — drives example labels only.
  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((h) => setAiOn(Boolean(h.ai)))
      .catch(() => setAiOn(null));
  }, []);

  // Restore a job after refresh: ?job= in the URL, else the last one this browser started.
  useEffect(() => {
    const fromUrl = new URLSearchParams(location.search).get("job");
    let fromStore: string | null = null;
    try {
      fromStore = localStorage.getItem(STORAGE_KEY);
    } catch {}
    const id = fromUrl ?? fromStore;
    if (id && /^[0-9a-f-]{36}$/i.test(id)) setPhase({ kind: "job", id });
  }, []);

  // Fill the instruction from example buttons elsewhere on the page.
  useEffect(() => {
    const onPick = (e: Event) => {
      const prompt = (e as CustomEvent<string>).detail;
      setInstruction(prompt);
      document.getElementById("workspace")?.scrollIntoView({ behavior: "smooth", block: "start" });
      setTimeout(() => textRef.current?.focus(), 300);
    };
    window.addEventListener("peedf:example", onPick);
    return () => window.removeEventListener("peedf:example", onPick);
  }, []);

  // Poll the active job.
  useEffect(() => {
    if (phase.kind !== "job") return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const started = Date.now();
    const tick = async () => {
      try {
        const r = await fetch(`/api/jobs/${phase.id}`, { cache: "no-store" });
        if (r.status === 404) {
          forget();
          setPhase({ kind: "compose" });
          setJob(null);
          return;
        }
        const j = (await r.json()) as JobView;
        if (stop) return;
        setJob(j);
        if (ACTIVE.includes(j.status)) {
          timer = setTimeout(tick, Date.now() - started > 30_000 ? 2000 : 900);
        } else if (j.status === "completed" || j.status === "failed") {
          track(j.status === "completed" ? "tool_complete" : "tool_error", {
            tool: "workspace",
            output: undefined,
            result: j.status,
            file_count: j.inputs.length,
          });
        }
      } catch {
        if (!stop) timer = setTimeout(tick, 3000);
      }
    };
    tick();
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [phase]);

  function remember(id: string) {
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {}
    const url = new URL(location.href);
    url.searchParams.set("job", id);
    history.replaceState(null, "", url);
  }

  function forget() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    const url = new URL(location.href);
    url.searchParams.delete("job");
    history.replaceState(null, "", url);
  }

  function addFiles(list: File[]) {
    setError("");
    const ok: File[] = [];
    for (const f of list) {
      if (!isAccepted(f)) {
        setError(`${f.name} isn't a PDF, JPG or PNG.`);
        track("file_rejected", { tool: "workspace", reason: "type" });
        continue;
      }
      if (f.size > MAX_FILE_MB * 1048576) {
        setError(`${f.name} is larger than ${MAX_FILE_MB} MB.`);
        track("file_rejected", { tool: "workspace", reason: "size" });
        continue;
      }
      ok.push(f);
    }
    setFiles((cur) => {
      const next = [...cur, ...ok].slice(0, MAX_FILES);
      if (cur.length + ok.length > MAX_FILES) setError(`You can add up to ${MAX_FILES} files at a time.`);
      return next;
    });
    if (ok.length) track("file_added", { tool: "workspace", file_count: ok.length, size_band: sizeBand(ok.reduce((n, f) => n + f.size, 0)) });
  }

  function move(i: number, d: -1 | 1) {
    setFiles((cur) => {
      const n = [...cur];
      const j = i + d;
      if (j < 0 || j >= n.length) return cur;
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });
  }

  const submit = useCallback(() => {
    setError("");
    const text = instruction.trim();
    if (!files.length) return setError("Add a PDF (or images) first.");
    if (!text) {
      textRef.current?.focus();
      return setError("Tell Peedf what you'd like to do.");
    }
    const total = files.reduce((n, f) => n + f.size, 0);
    if (total > MAX_TOTAL_MB * 1048576) return setError(`Files in one request can total up to ${MAX_TOTAL_MB} MB.`);
    const fd = new FormData();
    fd.set("instruction", text);
    files.forEach((f) => fd.append("files", f, f.name));
    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;
    xhr.open("POST", "/api/jobs");
    xhr.responseType = "json";
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) setPhase({ kind: "uploading", pct: Math.round((e.loaded / e.total) * 100) });
    };
    xhr.onload = () => {
      xhrRef.current = null;
      const body = xhr.response as { id?: string; error?: string } | null;
      if (xhr.status === 201 && body?.id) {
        remember(body.id);
        setJob(null);
        setPhase({ kind: "job", id: body.id });
        track("tool_run", { tool: "workspace", file_count: files.length, size_band: sizeBand(total) });
      } else {
        setPhase({ kind: "compose" });
        setError(body?.error ?? "Upload failed. Please try again.");
      }
    };
    xhr.onerror = () => {
      xhrRef.current = null;
      setPhase({ kind: "compose" });
      setError("Upload failed. Check your connection and try again.");
    };
    xhr.onabort = () => {
      xhrRef.current = null;
      setPhase({ kind: "compose" });
    };
    setPhase({ kind: "uploading", pct: 0 });
    xhr.send(fd);
  }, [files, instruction]);

  async function cancel() {
    if (!job) return;
    await fetch(`/api/jobs/${job.id}/cancel`, { method: "POST" }).catch(() => {});
    setPhase({ kind: "job", id: job.id });
  }

  async function revise(text: string) {
    if (!job) return;
    setError("");
    const r = await fetch(`/api/jobs/${job.id}/instruction`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ instruction: text }),
    });
    if (r.ok) {
      setJob(null);
      setPhase({ kind: "job", id: job.id });
    } else {
      const b = await r.json().catch(() => ({}));
      setError(b.error ?? "Couldn't restart this job.");
    }
  }

  function startOver(keepFiles: boolean) {
    forget();
    setJob(null);
    setError("");
    if (!keepFiles) {
      setFiles([]);
      setInstruction("");
    }
    setPhase({ kind: "compose" });
  }

  const busy = phase.kind === "uploading";

  return (
    <div className="card-chunky p-4 shadow-[0_18px_40px_rgba(24,26,31,0.07)] sm:p-6">
      {phase.kind !== "job" ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          aria-busy={busy}
        >
          <label
            htmlFor={inputId}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setOver(false);
              if (!busy) addFiles(Array.from(e.dataTransfer.files));
            }}
            className={`flex cursor-pointer flex-col items-center rounded-[1.1rem] border-2 border-dashed px-4 text-center transition-colors focus-within:border-[var(--accent)] focus-within:ring-2 focus-within:ring-[var(--accent)] focus-within:ring-offset-2 hover:border-[var(--accent)] ${
              files.length ? "py-5" : "py-9 sm:py-11"
            } ${over ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--border)] bg-[var(--surface-soft)]"}`}
          >
            <input
              id={inputId}
              type="file"
              multiple
              accept="application/pdf,.pdf,image/jpeg,.jpg,.jpeg,image/png,.png"
              className="sr-only"
              disabled={busy}
              onChange={(e) => {
                addFiles(Array.from(e.target.files ?? []));
                e.currentTarget.value = "";
              }}
            />
            <span aria-hidden="true" className="flex h-11 w-11 items-center justify-center rounded-[0.8rem] border-2 border-[var(--accent-dark)] bg-[var(--accent-soft)]">
              <Upload size={20} className="text-[var(--accent-dark)]" />
            </span>
            <span className="font-display mt-3 text-base font-bold">
              {files.length ? "Add more files" : "Drag and drop your PDFs here"}
            </span>
            <span className="mt-1 text-sm text-[var(--muted)]">
              or <span className="font-semibold text-[var(--accent-dark)] underline">choose files</span> · PDF, JPG, PNG · up to {MAX_FILE_MB} MB each
            </span>
          </label>

          {files.length > 0 && (
            <ol aria-label="Your files, in order" className="mt-3 divide-y divide-[var(--border)] rounded-[0.9rem] border-2 border-[var(--border)]">
              {files.map((f, i) => (
                <li key={`${f.name}-${f.size}-${i}`} className="flex items-center gap-2 px-3 py-2 text-sm">
                  {f.type.startsWith("image/") ? (
                    <FileImage size={17} className="shrink-0 text-[var(--muted)]" aria-hidden="true" />
                  ) : (
                    <FileText size={17} className="shrink-0 text-[var(--muted)]" aria-hidden="true" />
                  )}
                  <span className="w-5 shrink-0 text-xs text-[var(--muted)]">{i + 1}.</span>
                  <span className="min-w-0 flex-1 truncate">{f.name}</span>
                  <span className="shrink-0 text-xs text-[var(--muted)]">{fmtSize(f.size)}</span>
                  {files.length > 1 && (
                    <>
                      <button type="button" disabled={busy || i === 0} onClick={() => move(i, -1)} aria-label={`Move ${f.name} up`} className="rounded p-1 disabled:opacity-30">
                        <ArrowUp size={15} aria-hidden="true" />
                      </button>
                      <button type="button" disabled={busy || i === files.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${f.name} down`} className="rounded p-1 disabled:opacity-30">
                        <ArrowDown size={15} aria-hidden="true" />
                      </button>
                    </>
                  )}
                  <button type="button" disabled={busy} onClick={() => setFiles((c) => c.filter((_, j) => j !== i))} aria-label={`Remove ${f.name}`} className="rounded p-1 disabled:opacity-30">
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ol>
          )}

          <label htmlFor="ws-instruction" className="font-display mt-5 block text-base font-bold">
            What would you like to do?
          </label>
          <textarea
            id="ws-instruction"
            ref={textRef}
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                submit();
              }
            }}
            rows={3}
            maxLength={1000}
            disabled={busy}
            placeholder="Summarise this document and extract the key dates."
            aria-describedby="ws-hint"
            className="mt-2 w-full resize-y rounded-[0.9rem] border-2 border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-base leading-6 outline-none focus:border-[var(--accent)]"
          />
          <div className="mt-2 flex flex-wrap gap-2" aria-label="Suggestions">
            {["Summarise this document and extract the key dates.", "Remove pages 5–8 and compress the rest.", "Merge these PDFs."].map((s) => (
              <button
                key={s}
                type="button"
                disabled={busy}
                onClick={() => setInstruction(s)}
                className="chip bg-[var(--surface)] px-3 py-1 text-xs text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--fg)]"
              >
                {s}
              </button>
            ))}
          </div>

          <button type="submit" disabled={busy} className="btn btn-primary mt-5 w-full px-6 py-3.5 text-base disabled:opacity-60">
            {phase.kind === "uploading" ? (
              <span className="flex items-center gap-2">
                <Loader2 className="animate-spin" size={18} aria-hidden="true" />
                Uploading… {phase.pct}%
              </span>
            ) : (
              <>
                <Send size={17} aria-hidden="true" />
                Process document
              </>
            )}
          </button>
          {phase.kind === "uploading" && (
            <>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--surface-soft)]" role="progressbar" aria-valuenow={phase.pct} aria-valuemin={0} aria-valuemax={100} aria-label="Upload progress">
                <div className="h-full bg-[var(--accent)] transition-[width]" style={{ width: `${phase.pct}%` }} />
              </div>
              <button type="button" onClick={() => xhrRef.current?.abort()} className="mt-2 text-sm text-[var(--muted)] underline">
                Cancel upload
              </button>
            </>
          )}
          <p id="ws-hint" className="mt-3 flex items-start gap-1.5 text-xs leading-5 text-[var(--muted)]">
            <ShieldCheck size={14} className="mt-0.5 shrink-0 text-[var(--success)]" aria-hidden="true" />
            <span>
              Files are uploaded to Peedf to process this request and deleted automatically after 24 hours.{" "}
              {aiOn === false ? "AI features are switching on soon; PDF edits work now." : "AI tasks send the document's text to our AI provider."}{" "}
              <a href="/privacy#workspace" className="underline">How we handle files</a>
            </span>
          </p>
          <div role="alert" aria-live="assertive">
            {error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          </div>
        </form>
      ) : (
        <JobPanel job={job} onCancel={cancel} onRevise={revise} onStartOver={startOver} error={error} />
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- */

function JobPanel({
  job,
  onCancel,
  onRevise,
  onStartOver,
  error,
}: {
  job: JobView | null;
  onCancel: () => void;
  onRevise: (text: string) => void;
  onStartOver: (keepFiles: boolean) => void;
  error: string;
}) {
  const [text, setText] = useState("");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const status = job?.status;

  useEffect(() => {
    if (job?.status === "needs_input" || job?.status === "completed") setText("");
    if (job && !ACTIVE.includes(job.status)) headingRef.current?.focus();
  }, [job?.status, job]);

  if (!job) {
    return (
      <div className="flex items-center gap-3 py-10 text-[var(--muted)]" role="status">
        <Loader2 className="animate-spin" size={20} aria-hidden="true" /> Loading your job…
      </div>
    );
  }

  const active = ACTIVE.includes(job.status);
  const steps = job.plan?.steps ?? [];
  const p = job.progress;
  const pct = active && p.total ? Math.round((((p.step ?? 1) - 1) / p.total) * 100 + (job.status === "validating" ? 100 / p.total / 2 : 0)) : status === "completed" ? 100 : 0;

  return (
    <section aria-labelledby="job-heading">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="job-heading" ref={headingRef} tabIndex={-1} className="font-display text-lg font-extrabold outline-none">
          {STATUS_TEXT[job.status]}
        </h2>
        <StatusPill status={job.status} />
      </div>

      {job.instruction && <p className="mt-2 rounded-xl bg-[var(--surface-soft)] px-3 py-2 text-sm">“{job.instruction}”</p>}

      <ul className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--muted)]" aria-label="Files">
        {job.inputs.map((f) => (
          <li key={f.id} className="chip bg-[var(--surface)] px-2.5 py-1">
            {f.name}
            {f.pages ? ` · ${f.pages} p` : ""}
            {f.scanned ? " · scanned" : ""}
          </li>
        ))}
      </ul>

      {active && (
        <div className="mt-5" role="status" aria-live="polite">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Loader2 className="animate-spin text-[var(--accent)]" size={17} aria-hidden="true" />
            {p.total ? `Step ${p.step} of ${p.total} · ` : ""}
            {p.message ?? (job.status === "queued" ? "Waiting for a free worker…" : "Working…")}
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--surface-soft)]">
            <div className="h-full bg-[var(--accent)] transition-[width] duration-500" style={{ width: `${Math.max(pct, 6)}%` }} />
          </div>
          <button type="button" onClick={onCancel} className="mt-3 inline-flex items-center gap-1 text-sm text-[var(--muted)] underline">
            <X size={14} aria-hidden="true" /> Cancel
          </button>
        </div>
      )}

      {steps.length > 0 && (
        <ol className="mt-5 space-y-1.5 text-sm" aria-label="Steps">
          {steps.map((s, i) => {
            const n = i + 1;
            const done = status === "completed" || (active && (p.step ?? 0) > n);
            const current = active && p.step === n;
            return (
              <li key={i} className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-[0.7rem] font-bold ${
                    done ? "bg-[var(--success)] text-white" : current ? "bg-[var(--accent)] text-white" : "bg-[var(--surface-soft)] text-[var(--muted)]"
                  }`}
                >
                  {done ? "✓" : n}
                </span>
                <span className={current ? "font-semibold" : ""}>{STEP_LABEL[s.tool]?.(s) ?? s.tool}</span>
                <span className="sr-only">{done ? "(done)" : current ? "(in progress)" : ""}</span>
              </li>
            );
          })}
        </ol>
      )}

      {(status === "needs_input" || status === "failed" || status === "cancelled") && (
        <div className="mt-5">
          {job.error && status !== "cancelled" && (
            <p className={`flex gap-2 rounded-xl p-3 text-sm ${status === "failed" ? "bg-red-50 text-red-700" : "bg-[var(--accent-soft)] text-[var(--fg)]"}`}>
              <CircleAlert size={17} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span>{job.error.message}</span>
            </p>
          )}
          {!job.purged && (
            <ReviseForm
              label={status === "needs_input" ? "Reply or rephrase your request" : "Try a different instruction on the same files"}
              value={text}
              onChange={setText}
              onSubmit={() => onRevise(text.trim() || job.instruction || "")}
              submitLabel={status === "failed" && !text.trim() ? "Try again" : "Run"}
            />
          )}
        </div>
      )}

      {status === "completed" && (
        <div className="mt-6">
          {job.notes.length > 0 && (
            <ul className="mb-4 space-y-1.5 text-sm text-[var(--muted)]">
              {job.notes.map((n) => (
                <li key={n} className="flex gap-2">
                  <CircleAlert size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
                  {n}
                </li>
              ))}
            </ul>
          )}
          {job.analyses.map((a, i) => (
            <AnalysisView key={i} a={a} />
          ))}
          <Outputs job={job} />
          {!job.purged && (
            <ReviseForm
              label="Do something else with these files"
              value={text}
              onChange={setText}
              onSubmit={() => text.trim() && onRevise(text.trim())}
              submitLabel="Run"
            />
          )}
        </div>
      )}

      <div role="alert" aria-live="assertive">
        {error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      </div>

      {!active && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t-2 border-[var(--border)] pt-4">
          <button type="button" onClick={() => onStartOver(false)} className="btn btn-outline px-4 py-2 text-sm">
            <RotateCcw size={15} aria-hidden="true" /> Start a new task
          </button>
          <p className="text-xs text-[var(--muted)]">
            {job.purged ? "Files from this job have been deleted." : `Files are deleted automatically ${expiry(job.expiresAt)}.`}
          </p>
        </div>
      )}
    </section>
  );
}

function expiry(iso: string) {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "shortly";
  const h = Math.round(ms / 3600000);
  return h >= 1 ? `in about ${h} hour${h === 1 ? "" : "s"}` : `in ${Math.max(1, Math.round(ms / 60000))} minutes`;
}

function StatusPill({ status }: { status: JobView["status"] }) {
  const tone =
    status === "completed"
      ? "bg-[var(--success-bg)] text-[var(--success)]"
      : status === "failed"
        ? "bg-red-50 text-red-700"
        : status === "needs_input"
          ? "bg-[var(--coral-soft)] text-[var(--coral-dark)]"
          : "bg-[var(--accent-soft)] text-[var(--accent-dark)]";
  return <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${tone}`}>{STATUS_TEXT[status]}</span>;
}

function ReviseForm(props: { label: string; value: string; onChange: (v: string) => void; onSubmit: () => void; submitLabel: string }) {
  const id = useId();
  return (
    <form
      className="mt-4"
      onSubmit={(e) => {
        e.preventDefault();
        props.onSubmit();
      }}
    >
      <label htmlFor={id} className="block text-sm font-semibold">
        {props.label}
      </label>
      <div className="mt-2 flex gap-2">
        <input
          id={id}
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          maxLength={1000}
          autoComplete="off"
          className="min-w-0 flex-1 rounded-[0.9rem] border-2 border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-base outline-none focus:border-[var(--accent)] sm:text-sm"
          placeholder="e.g. Only remove pages 5–6"
        />
        <button type="submit" className="btn btn-dark px-4 py-2 text-sm">
          {props.submitLabel}
        </button>
      </div>
    </form>
  );
}

function AnalysisView({ a }: { a: Analysis }) {
  const multi = a.documents.length > 1;
  const cite = (doc: number, page: number) => (multi ? `Doc ${doc}, p. ${page}` : `p. ${page}`);
  return (
    <article className="mb-6 rounded-[1rem] border-2 border-[var(--border)] p-4 sm:p-5" aria-label={a.title || "AI result"}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-display text-lg font-extrabold">{a.title || "Result"}</h3>
        <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[0.7rem] font-bold uppercase tracking-wide text-[var(--accent-dark)]">
          AI-generated
        </span>
      </div>
      <Markdown source={a.answer_markdown} />

      {a.key_points.length > 0 && (
        <>
          <h4 className="font-display mt-5 text-base font-bold">Key points</h4>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-[0.95rem]">
            {a.key_points.map((k, i) => (
              <li key={i}>
                {k.text}
                {k.pages.length > 0 && <span className="text-[var(--muted)]"> ({k.pages.map((p) => cite(k.doc, p)).join(", ")})</span>}
              </li>
            ))}
          </ul>
        </>
      )}

      {a.records.length > 0 && (
        <>
          <h4 className="font-display mt-5 text-base font-bold">Extracted from the document</h4>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr>
                  {a.fields.map((f) => (
                    <th key={f} scope="col" className="border-b-2 border-[var(--border)] px-2 py-1.5">{f}</th>
                  ))}
                  <th scope="col" className="border-b-2 border-[var(--border)] px-2 py-1.5">Source</th>
                </tr>
              </thead>
              <tbody>
                {a.records.map((r, i) => (
                  <tr key={i}>
                    {a.fields.map((f) => (
                      <td key={f} className="border-b border-[var(--border)] px-2 py-1.5 align-top">
                        {r.fields.find((x) => x.name.toLowerCase() === f.toLowerCase())?.value ?? ""}
                      </td>
                    ))}
                    <td className="whitespace-nowrap border-b border-[var(--border)] px-2 py-1.5 align-top">
                      <Verified ok={r.verified} where={cite(r.doc, r.page)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {a.facts.length > 0 && (
        <details className="mt-5" open={a.facts.length <= 8}>
          <summary className="font-display cursor-pointer text-base font-bold">
            Source evidence ({a.verification.verified} of {a.verification.checked} matched)
          </summary>
          <ul className="mt-2 space-y-2.5">
            {a.facts.map((f, i) => (
              <li key={i} className="text-sm">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-semibold">{f.label}:</span>
                  <span>{f.value}</span>
                  <Verified ok={f.verified} where={cite(f.doc, f.page)} />
                </div>
                <blockquote className="mt-1 border-l-2 border-[var(--border)] pl-3 text-[var(--muted)]">“{f.quote}”</blockquote>
              </li>
            ))}
          </ul>
        </details>
      )}

      {a.not_found.length > 0 && (
        <p className="mt-4 text-sm">
          <span className="font-semibold">Not found in the document:</span> {a.not_found.join(", ")}
        </p>
      )}

      <ul className="mt-4 space-y-1 text-xs leading-5 text-[var(--muted)]">
        {a.caveats.map((c) => (
          <li key={c}>• {c}</li>
        ))}
        <li>• AI results can contain mistakes. Check important details against the original before relying on them.</li>
      </ul>
    </article>
  );
}

function Verified({ ok, where }: { ok: boolean; where: string }) {
  return ok ? (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--success)]">
      <CheckCircle2 size={13} aria-hidden="true" /> {where} · matches source
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--coral-dark)]">
      <CircleAlert size={13} aria-hidden="true" /> {where} · unverified, check original
    </span>
  );
}

function Outputs({ job }: { job: JobView }) {
  if (!job.outputs.length) return null;
  return (
    <div>
      <h3 className="font-display text-base font-bold">Your files</h3>
      <ul className="mt-2 space-y-2">
        {job.outputs.map((o) => (
          <li key={o.id} className="flex flex-wrap items-center gap-3 rounded-[0.9rem] border-2 border-[var(--border)] p-3">
            {o.mime === "image/jpeg" && o.previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={o.previewUrl} alt="" className="h-14 w-11 shrink-0 rounded border border-[var(--border)] object-cover" />
            ) : (
              <FileText size={22} className="shrink-0 text-[var(--accent-dark)]" aria-hidden="true" />
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{o.name}</div>
              <div className="text-xs text-[var(--muted)]">
                {fmtSize(o.size)}
                {o.pages ? ` · ${o.pages} page${o.pages === 1 ? "" : "s"}` : ""}
              </div>
            </div>
            {o.previewUrl && o.mime === "application/pdf" && (
              <a href={o.previewUrl} target="_blank" rel="noopener" className="btn btn-outline px-3 py-2 text-sm">
                <ExternalLink size={14} aria-hidden="true" /> Preview
              </a>
            )}
            {o.url ? (
              <a href={o.url} download={o.name} className="btn btn-primary px-4 py-2 text-sm">
                <Download size={15} aria-hidden="true" /> Download
              </a>
            ) : (
              <span className="text-xs text-[var(--muted)]">Deleted</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Buttons used by the example section to feed the same instruction box. */
export function ExampleButton({ ex, aiOn }: { ex: Example; aiOn: boolean | null }) {
  const unavailable = ex.needs === "soon" || (ex.needs === "ai" && aiOn === false);
  return (
    <button
      type="button"
      disabled={unavailable}
      onClick={() => window.dispatchEvent(new CustomEvent("peedf:example", { detail: ex.prompt }))}
      className="group flex w-full items-start justify-between gap-2 rounded-[0.8rem] border-2 border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-left text-sm transition-colors hover:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-[var(--border)]"
    >
      <span>{ex.prompt}</span>
      {unavailable && (
        <span className="shrink-0 rounded-full bg-[var(--surface-soft)] px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-[var(--muted)]">
          Soon
        </span>
      )}
    </button>
  );
}

export function ExampleGroups() {
  const [aiOn, setAiOn] = useState<boolean | null>(null);
  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((h) => setAiOn(Boolean(h.ai)))
      .catch(() => setAiOn(null));
  }, []);
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {exampleGroups.map((g) => (
        <section key={g.id} aria-labelledby={`ex-${g.id}`} className="card-chunky p-5">
          <h3 id={`ex-${g.id}`} className="font-display text-base font-bold">
            {g.title}
          </h3>
          <div className="mt-3 space-y-2">
            {g.examples.map((ex) => (
              <ExampleButton key={ex.prompt} ex={ex} aiOn={aiOn} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
