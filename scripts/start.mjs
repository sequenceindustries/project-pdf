// Production entrypoint for a single Railway service: runs the Next.js web
// server and the background worker as two supervised child processes.
// The worker restarts with backoff if it crashes; SIGTERM is forwarded to
// both so in-flight jobs are handed back to the queue before exit.
//
// To split them later, run `npm run start:web` and `npm run worker` as two
// Railway services from the same repo.

import { spawn } from "node:child_process";

const children = new Map();
let stopping = false;
let workerRestarts = 0;

function start(name, cmd, args) {
  const child = spawn(cmd, args, { stdio: "inherit", env: process.env });
  children.set(name, child);
  child.on("exit", (code, signal) => {
    children.delete(name);
    if (stopping) {
      if (!children.size) process.exit(0);
      return;
    }
    if (name === "web") {
      console.error(JSON.stringify({ level: "error", event: "web_exited", code, signal }));
      shutdown(1);
      return;
    }
    const delay = Math.min(30_000, 1000 * 2 ** Math.min(workerRestarts++, 5));
    console.error(JSON.stringify({ level: "error", event: "worker_exited", code, signal, restart_in_ms: delay }));
    setTimeout(() => start("worker", ...WORKER), delay);
  });
}

const WORKER = [process.execPath, ["--import", "tsx", "worker/main.ts"]];

function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const c of children.values()) c.kill("SIGTERM");
  setTimeout(() => process.exit(code), 15_000).unref();
}

process.on("SIGTERM", () => shutdown(0));
process.on("SIGINT", () => shutdown(0));

start("web", process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", process.env.PORT ?? "3000"]);
start("worker", ...WORKER);
// Reset the crash counter once the worker has been healthy for a while.
setInterval(() => (workerRestarts = 0), 10 * 60_000).unref();
