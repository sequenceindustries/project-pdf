# Peedf architecture

Peedf has two ways to work:

| | Workspace (homepage) | Single tools (`/merge`, `/compress`, …) |
|---|---|---|
| Where files are processed | Our server, in a sandboxed worker thread | The visitor's browser |
| Uploads | Yes, stored in Postgres, deleted after 24 h | Never |
| AI | Optional, for understanding tasks only | None |

## Request flow (workspace)

```
browser ──POST /api/jobs (files + instruction)──► web (Next.js route)
          validate type by magic bytes, size, count, rate limits
          store files + job row (status=queued) in one transaction
browser ──GET /api/jobs/:id (poll)──────────────► web
worker  ──claim (FOR UPDATE SKIP LOCKED, lease)─► Postgres
          1. inspect each file in the sandbox (pages, encryption, text layer)
          2. plan: rule planner → AI planner (instruction + file metadata only)
          3. validatePlan against real page counts/types/limits
          4. execute steps in sandbox threads; analyze steps call the model
          5. re-open and check every output; verify AI quotes against page text
          6. store outputs + result, status=completed (one transaction)
browser ──GET /api/files/:id?exp&sig────────────► web (owner cookie + signature)
```

**AI interprets and plans. Specialised tools do the work. Validation checks the output. The database records the result.**

## Components

| Concern | Where |
|---|---|
| Frontend workspace | `components/workspace/*`, `app/page.tsx` |
| API | `app/api/jobs/**`, `app/api/files/[id]`, `app/api/health` |
| Auth (anonymous visitor) | `lib/server/session.ts`. Signed HttpOnly cookie; jobs store `sha256(visitor)`. Swap for user ids when accounts arrive. |
| Task engine contract | `lib/engine/plan.ts`: closed tool set (zod), `validatePlan`, page tracking through steps |
| Planners | `lib/engine/rule-planner.ts` (free, deterministic), `lib/engine/ai-planner.ts` |
| PDF operations | `lib/engine/ops.ts`: pdf-lib, pdf.js + @napi-rs/canvas, JSZip |
| Sandbox | `lib/engine/sandbox.ts`. One worker thread per step, heap cap, timeout, no env/secrets, `fetch` disabled |
| AI analysis + verification | `lib/engine/analyze.ts`, `lib/engine/llm.ts` |
| Background jobs | `worker/main.ts` (poll, lease/heartbeat, graceful release, sweeper), `worker/process-job.ts` |
| Storage | `lib/server/storage.ts`. Postgres `bytea` for the MVP, behind a small interface so it can move to private R2/S3 |
| Usage + limits | `usage_events` table; limits in `lib/server/config.ts` |
| Logging / MOTHER | `lib/server/events.ts`. JSON logs with ids, counts and durations only; optional `EVENTS_WEBHOOK_URL` |

Engine and worker files use **relative imports** (not `@/`) because they also run outside the Next.js bundler (worker process and sandbox threads).

## Job lifecycle

`queued → processing → validating → completed`, or `needs_input` (clarification or a fixable request; the user can send a new instruction on the same files), `failed` (after up to 3 attempts for transient errors) or `cancelled`.

- A job is only `completed` after every output is re-opened and checked (page counts, valid zip/xlsx/jpeg).
- Leases are renewed every 40 s. A crashed worker's job is picked up after the lease expires; on SIGTERM jobs are handed back immediately.
- Transient AI errors (rate limits, timeouts, 5xx) retry with backoff (15 s, 30 s).

## Security

- File type is decided by magic bytes; names are sanitised and only used as download labels.
- Every document operation runs in a fresh worker thread with a memory cap and timeout. A malformed PDF kills only that thread.
- The model can only call one forced "submit" tool with a fixed schema. It cannot run code, fetch URLs or pick tools outside the closed set, and plans are validated before running.
- **Prompt injection:** the planner never sees document text. The analysis model receives document text inside `<document>` tags marked untrusted, with tag-like strings escaped, and reports `injection_detected`, which is shown to the user.
- Ownership: every job/file query filters by owner hash. Downloads need the owner cookie and an unexpired HMAC signature bound to file and owner. 404s don't distinguish "missing" from "not yours".
- POSTs require same origin (plus SameSite=Lax cookies). Oversized bodies are rejected from `Content-Length` before buffering.
- Client IP comes from `X-Real-IP` / the proxy-appended `X-Forwarded-For` hop, never the client-controlled leftmost entry.
- Spreadsheet output writes every cell as text (no formulas); CSV cells starting with `= + - @` are neutralised.
- Logs never contain file names, contents, instructions or AI output. IPs are stored only as keyed hashes.

## Retention

| Data | Kept |
|---|---|
| Uploaded files, outputs, instruction, AI result, file names | `RETENTION_HOURS` (24 h), then purged by the sweeper |
| Content-free job metadata (status, timings, page counts, tools) | `JOB_METADATA_DAYS` (30 d) |
| Usage events (runs, tokens, pages; no content) | `JOB_METADATA_DAYS` (30 d) |

## Cost control

- Rule planner first (free); the AI planner only for instructions it can't parse, and it never receives document text.
- Deterministic tools for all page/file operations; AI only for understanding tasks.
- Caps: AI pages per job, AI runs per visitor and per network per day (re-runs count), chunk count for long documents.
- Every AI call records model and input/output tokens in `usage_events`; set `AI_PRICE_*` to report estimated cost per job.
- Billing hooks: quotas read from `usage_events`, so tiers can be added without schema changes.

## Not built yet (and shown as "soon" in the UI)

OCR for scanned documents, translation, PDF → Word, accounts and billing.
Scanned PDFs are detected (text per page) and get a clear message instead of an empty AI answer.

## Running locally

```bash
cp .env.example .env.local     # set DATABASE_URL and SESSION_SECRET
npm install
npm run dev                    # web
npm run dev:worker             # worker (separate terminal)
npm test                       # unit + sandboxed PDF operation tests
DATABASE_URL=postgres://…/peedf_test npm run test:integration
```

## Deploying (Railway)

One service runs `npm start` (`scripts/start.mjs`), which supervises the web server and the worker. To scale separately, create a second service from the same repo with start command `npm run worker`, and set the web service's start command to `npm run start:web`.

Required variables on the app service: `DATABASE_URL=${{Postgres.DATABASE_URL}}`, `SESSION_SECRET`. Optional: `ANTHROPIC_API_KEY`.
