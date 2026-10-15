/** Shapes returned by /api/jobs/:id, shared by the workspace UI. */

export type JobStatus = "queued" | "processing" | "validating" | "completed" | "failed" | "cancelled" | "needs_input";

export type Fact = {
  category: string;
  label: string;
  value: string;
  doc: number;
  page: number;
  quote: string;
  verified: boolean;
};

export type RecordRow = {
  doc: number;
  page: number;
  quote: string;
  fields: { name: string; value: string }[];
  verified: boolean;
};

export type Analysis = {
  mode: "summary" | "answer" | "explain" | "extract" | "compare";
  title: string;
  answer_markdown: string;
  key_points: { text: string; doc: number; pages: number[] }[];
  facts: Fact[];
  records: RecordRow[];
  fields: string[];
  not_found: string[];
  caveats: string[];
  documents: { n: number; name: string; pages: number }[];
  verification: { checked: number; verified: number };
};

export type PlanStep = { tool: string; inputs: string[]; [k: string]: unknown };

export type JobView = {
  id: string;
  status: JobStatus;
  instruction: string | null;
  progress: { step?: number; total?: number; message?: string };
  error: { code: string | null; message: string } | null;
  plan: { steps: PlanStep[] } | null;
  planner: string | null;
  analyses: Analysis[];
  notes: string[];
  createdAt: string;
  finishedAt: string | null;
  expiresAt: string;
  purged: boolean;
  inputs: { id: string; name: string; mime: string; size: number; pages: number | null; scanned: boolean }[];
  outputs: { id: string; name: string; mime: string; size: number; pages: number | null; url: string | null; previewUrl: string | null }[];
};

export const ACTIVE: JobStatus[] = ["queued", "processing", "validating"];
