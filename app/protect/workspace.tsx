"use client";
import { useState } from "react";
import { PDFDocument } from "@cantoo/pdf-lib";
import { Download, Loader2, FileText, Lock } from "lucide-react";
import Header from "@/components/Header";
import Dropzone from "@/components/Dropzone";
import StatusMessage from "@/components/StatusMessage";
import { isPdf, MAX_FILE_SIZE } from "@/lib/pdf-utils";

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
      return;
    }
    if (f.size > MAX_FILE_SIZE) {
      setError("File is larger than the 50 MB limit.");
      return;
    }
    setFile(f);
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
    try {
      const doc = await PDFDocument.load(await file.arrayBuffer());
      await doc.encrypt({ userPassword: password, ownerPassword: password });
      const blob = new Blob([(await doc.save()) as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name.replace(/\.pdf$/i, "") + "-protected.pdf";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError("Couldn't protect that PDF. It may already be encrypted or corrupted.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen">
      <Header />
      <section className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="text-center">
          <h1 className="font-display text-3xl font-bold sm:text-4xl">Password Protect PDF</h1>
          <p className="mt-3 text-[var(--muted)]">
            Encrypt a PDF so it can only be opened with a password.
          </p>
        </div>

        {!file && (
          <Dropzone
            accept="application/pdf,.pdf"
            onFiles={handleFiles}
            title="Drop a PDF here"
            subtitle="or click to browse"
          />
        )}

        {file && (
          <div className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
            <div className="flex items-center gap-3 border-b border-[var(--border)] pb-4">
              <FileText size={20} className="shrink-0 text-[var(--muted)]" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{file.name}</div>
              </div>
              <button
                onClick={() => {
                  setFile(null);
                  setError("");
                }}
                className="shrink-0 text-sm text-[var(--muted)] underline"
              >
                Change file
              </button>
            </div>

            <label className="mt-5 block text-sm font-medium">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              className="mt-2 w-full rounded-xl border border-[var(--border)] px-4 py-3 text-sm outline-none focus:border-[var(--accent)]"
            />

            <label className="mt-4 block text-sm font-medium">Confirm password</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              className="mt-2 w-full rounded-xl border border-[var(--border)] px-4 py-3 text-sm outline-none focus:border-[var(--accent)]"
            />
            <p className="mt-2 text-xs text-[var(--muted)]">
              Keep this password somewhere safe — it can&apos;t be recovered if lost.
            </p>

            <button
              disabled={busy}
              onClick={apply}
              className="mt-6 w-full rounded-xl bg-black px-5 py-3.5 font-semibold text-white transition-opacity disabled:opacity-40"
            >
              {busy ? (
                <Loader2 className="mx-auto animate-spin" />
              ) : (
                <>
                  <Lock className="mr-2 inline" size={17} />
                  Protect & download
                </>
              )}
            </button>
          </div>
        )}

        <StatusMessage>{error}</StatusMessage>
      </section>
    </main>
  );
}
