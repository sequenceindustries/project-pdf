"use client";
import { useState } from "react";
import { Loader2, FileText, Lock } from "lucide-react";
import Dropzone from "@/components/Dropzone";
import StatusMessage from "@/components/StatusMessage";
import { baseName, downloadBlob, isPdf, MAX_FILE_SIZE } from "@/lib/pdf-utils";
import { durationBand, sizeBand, track } from "@/lib/analytics";

const TOOL = "protect";

export default function ProtectWorkspace() {
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function handleFiles(files: File[]) {
    setError("");
    const f = files[0];
    if (!f) return;
    if (!isPdf(f)) {
      setError("Please choose a PDF file.");
      track("file_rejected", { tool: TOOL, reason: "type" });
      return;
    }
    if (f.size > MAX_FILE_SIZE) {
      setError("File is larger than the 50 MB limit.");
      track("file_rejected", { tool: TOOL, reason: "size" });
      return;
    }
    setFile(f);
    track("file_added", { tool: TOOL, file_count: 1, size_band: sizeBand(f.size) });
  }

  async function apply() {
    if (!file) return;
    if (password.length < 4) {
      setError("Use a password with at least 4 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setBusy(true);
    setError("");
    const started = performance.now();
    // Nothing about the password is ever sent to analytics.
    track("tool_run", { tool: TOOL });
    try {
      // The encryption-capable pdf-lib fork is large, so it's only loaded on use.
      const { PDFDocument } = await import("@cantoo/pdf-lib");
      const doc = await PDFDocument.load(await file.arrayBuffer());
      await doc.encrypt({ userPassword: password, ownerPassword: password });
      const blob = new Blob([(await doc.save()) as BlobPart], { type: "application/pdf" });
      downloadBlob(blob, `${baseName(file)}-protected.pdf`);
      track("tool_complete", { tool: TOOL, output: "pdf", duration_band: durationBand(performance.now() - started) });
    } catch {
      setError("Couldn't protect that PDF. It may already be encrypted or corrupted.");
      track("tool_error", { tool: TOOL, reason: "unreadable" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="text-center">
        <h1 className="font-display text-4xl font-extrabold sm:text-5xl">Password Protect PDF</h1>
        <p className="mt-3 text-[var(--muted)]">Encrypt a PDF so it can only be opened with a password.</p>
      </div>

      {!file && (
        <Dropzone accept="application/pdf,.pdf" onFiles={handleFiles} title="Drop a PDF here" subtitle="or click to browse" />
      )}

      {file && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            apply();
          }}
          className="mt-6 card-chunky bg-[var(--surface-soft)] p-5 sm:p-6"
        >
          <div className="flex items-center gap-3 border-b border-[var(--border)] pb-4">
            <FileText size={20} className="shrink-0 text-[var(--muted)]" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{file.name}</div>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setFile(null);
                setError("");
              }}
              className="shrink-0 text-sm text-[var(--muted)] underline disabled:opacity-40"
            >
              Change file
            </button>
          </div>

          <label htmlFor="pw" className="mt-5 block text-sm font-medium">
            Password
          </label>
          <input
            id="pw"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            minLength={4}
            required
            aria-describedby="pw-help"
            className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-base outline-none focus:border-[var(--accent)] sm:text-sm"
          />

          <label htmlFor="pw-confirm" className="mt-4 block text-sm font-medium">
            Confirm password
          </label>
          <input
            id="pw-confirm"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            required
            className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-base outline-none focus:border-[var(--accent)] sm:text-sm"
          />
          <p id="pw-help" className="mt-2 text-xs text-[var(--muted)]">
            At least 4 characters. Keep it somewhere safe — it can&apos;t be recovered if lost. It
            never leaves this browser tab.
          </p>

          <button
            type="submit"
            disabled={busy}
            aria-busy={busy}
            className="mt-6 w-full btn btn-primary px-5 py-3.5 disabled:opacity-40"
          >
            {busy ? (
              <>
                <Loader2 className="mx-auto animate-spin" aria-hidden="true" />
                <span className="sr-only">Encrypting…</span>
              </>
            ) : (
              <>
                <Lock className="mr-2 inline" size={17} aria-hidden="true" />
                Protect & download
              </>
            )}
          </button>
        </form>
      )}

      <StatusMessage>{error}</StatusMessage>
    </section>
  );
}
