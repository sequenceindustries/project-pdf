import { Worker } from "node:worker_threads";
import { OpError, type Blob, type Inspection } from "./ops";
import type { SandboxOp } from "./sandbox-types";

/**
 * Runs one document operation in a fresh worker thread with a heap cap and a
 * wall-clock timeout. A pathological PDF (zip bomb, deep recursion, endless
 * loop) kills only that thread; the job fails with a clear error instead of
 * taking down the worker.
 */

const THREAD = new URL("./sandbox-entry.mjs", import.meta.url);

export type SandboxOptions = { timeoutMs: number; memoryMb: number };

export function runInSandbox<T>(
  op: SandboxOp,
  inputs: Blob[],
  args: Record<string, unknown>,
  opts: SandboxOptions
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const worker = new Worker(THREAD, {
      resourceLimits: { maxOldGenerationSizeMb: opts.memoryMb, maxYoungGenerationSizeMb: 64 },
      env: {}, // no secrets inside the sandbox
      stdout: true,
      stderr: true,
    });
    worker.stdout.resume();
    worker.stderr.resume();
    let settled = false;
    const done = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      worker.terminate().catch(() => {});
      fn();
    };
    const timer = setTimeout(
      () => done(() => reject(new OpError("timeout", "This document took too long to process."))),
      opts.timeoutMs
    );
    worker.on("message", (m: { ok: boolean; result?: T; code?: string; message?: string }) => {
      done(() => (m.ok ? resolve(m.result as T) : reject(new OpError(m.code ?? "processing_error", m.message ?? "Processing failed."))));
    });
    worker.on("error", (e) => {
      const oom = /heap|memory|ERR_WORKER_OUT_OF_MEMORY/i.test(String((e as { code?: string }).code ?? e.message));
      done(() =>
        reject(
          oom
            ? new OpError("too_large", "This document needs more memory than we allow per job. Try a smaller file.")
            : new OpError("processing_error", "The document couldn't be processed.")
        )
      );
    });
    worker.on("exit", (code) => {
      if (!settled) done(() => reject(new OpError("processing_error", `Processing stopped unexpectedly (${code}).`)));
    });
    // Copy inputs so the caller's buffers stay usable after transfer.
    const copies = inputs.map((b) => ({ ...b, bytes: new Uint8Array(b.bytes) }));
    worker.postMessage({ op, args, inputs: copies }, copies.map((c) => c.bytes.buffer as ArrayBuffer));
  });
}

export type { Blob, Inspection };
