/**
 * Server configuration, read from environment variables once.
 *
 * Limits below are operational safety caps, not pricing. Free/paid tiers will
 * be built on top of the usage_events table; until then every visitor gets
 * these defaults. Override any of them with env vars.
 */

function int(name: string, fallback: number) {
  const v = process.env[name];
  const n = v ? Number.parseInt(v, 10) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export const config = {
  databaseUrl: process.env.DATABASE_URL ?? "",
  sessionSecret: process.env.SESSION_SECRET ?? "",
  isProduction: process.env.NODE_ENV === "production",

  ai: {
    apiKey: process.env.ANTHROPIC_API_KEY ?? "",
    /** Cheap model: turns an instruction into a plan. Never sees document text. */
    plannerModel: process.env.AI_PLANNER_MODEL ?? "claude-haiku-5-5",
    /** Reads document text for summaries, answers and extraction. */
    analysisModel: process.env.AI_ANALYSIS_MODEL ?? "claude-sonnet-5-5",
    timeoutMs: int("AI_TIMEOUT_MS", 120_000),
    /** Characters of document text sent in a single request before chunking. */
    singlePassChars: int("AI_SINGLE_PASS_CHARS", 120_000),
    maxChunks: int("AI_MAX_CHUNKS", 6),
    /** Optional, for cost reporting only: USD per million tokens. */
    priceInputPerMTok: Number(process.env.AI_PRICE_INPUT_PER_MTOK ?? "") || null,
    priceOutputPerMTok: Number(process.env.AI_PRICE_OUTPUT_PER_MTOK ?? "") || null,
  },

  limits: {
    maxFileBytes: int("MAX_FILE_MB", 50) * 1024 * 1024,
    maxFilesPerJob: int("MAX_FILES_PER_JOB", 10),
    maxJobBytes: int("MAX_JOB_MB", 100) * 1024 * 1024,
    maxPagesPerFile: int("MAX_PAGES_PER_FILE", 500),
    maxAiPagesPerJob: int("MAX_AI_PAGES_PER_JOB", 150),
    maxInstructionChars: int("MAX_INSTRUCTION_CHARS", 1000),
    maxStepsPerPlan: int("MAX_STEPS_PER_PLAN", 8),
    maxActiveJobsPerVisitor: int("MAX_ACTIVE_JOBS_PER_VISITOR", 3),
    jobsPerVisitorPerDay: int("JOBS_PER_VISITOR_PER_DAY", 40),
    aiJobsPerVisitorPerDay: int("AI_JOBS_PER_VISITOR_PER_DAY", 10),
    jobsPerIpPerHour: int("JOBS_PER_IP_PER_HOUR", 60),
    aiJobsPerIpPerDay: int("AI_JOBS_PER_IP_PER_DAY", 30),
    stepTimeoutMs: int("STEP_TIMEOUT_MS", 180_000),
    sandboxMemoryMb: int("SANDBOX_MEMORY_MB", 1536),
  },

  retention: {
    /** File bytes, instruction text and results are deleted after this. */
    contentHours: int("RETENTION_HOURS", 24),
    /** Content-free job metadata (status, timings, page counts) kept for usage reporting. */
    metadataDays: int("JOB_METADATA_DAYS", 30),
  },

  downloadLinkTtlSeconds: int("DOWNLOAD_LINK_TTL_SECONDS", 900),

  worker: {
    concurrency: int("WORKER_CONCURRENCY", 2),
    leaseSeconds: int("WORKER_LEASE_SECONDS", 120),
    pollMs: int("WORKER_POLL_MS", 1000),
  },

  /** Optional MOTHER event stream (same convention as iHatePDF). */
  eventsWebhookUrl: process.env.EVENTS_WEBHOOK_URL ?? "",
  eventsWebhookSecret: process.env.EVENTS_WEBHOOK_SECRET ?? "",
} as const;

export function workspaceConfigured() {
  return Boolean(config.databaseUrl && (config.sessionSecret || !config.isProduction));
}

export function aiConfigured() {
  return Boolean(config.ai.apiKey);
}
