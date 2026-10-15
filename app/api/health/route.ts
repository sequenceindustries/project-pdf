import { NextResponse } from "next/server";
import { aiConfigured, workspaceConfigured } from "@/lib/server/config";
import { query } from "@/lib/server/db";
import { queueStats } from "@/lib/server/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Uptime/readiness for Railway and MOTHER. Counts only; no job or user data. */
export async function GET() {
  const body: Record<string, unknown> = { ok: true, service: "peedf", status: "operational", ai: aiConfigured() };
  if (workspaceConfigured()) {
    try {
      const t = Date.now();
      await query("select 1");
      body.db = { ok: true, latency_ms: Date.now() - t };
      body.queue = await queueStats().catch(() => null);
    } catch {
      body.db = { ok: false };
      body.status = "degraded";
    }
  } else {
    body.workspace = "not_configured";
  }
  return NextResponse.json(body, { headers: { "cache-control": "no-store" } });
}
