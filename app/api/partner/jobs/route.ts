import { NextResponse, after } from "next/server";
import { aiConfigured } from "@/lib/server/ai";
import { dbConfigured } from "@/lib/server/db";
import { checkPages, ExtractError } from "@/lib/server/extract";
import { createJob } from "@/lib/server/jobs";
import { drain } from "@/lib/server/engine";
import { partnerAuthorised, partnerConfigured, partnerJobSchema, takePartnerQuota } from "@/lib/server/partner";
import { routeInstruction } from "@/lib/server/router";

export const runtime = "nodejs";
export const maxDuration = 60;

const err = (status: number, code: string, message: string) =>
  NextResponse.json({ error: { code, message } }, { status });

/**
 * POST /api/partner/jobs — JSON { instruction, filename, pages: [{n, text}] }.
 * Returns { id, token }; poll with the normal GET /api/jobs/:id + x-job-token.
 */
export async function POST(req: Request) {
  if (!partnerConfigured()) return err(404, "not_found", "Not found.");
  if (!partnerAuthorised(req.headers.get("authorization"))) return err(401, "unauthorised", "Unauthorised.");
  if (!dbConfigured() || !aiConfigured())
    return err(503, "not_configured", "The AI isn't switched on yet. Please try again later.");

  if (Number(req.headers.get("content-length") ?? 0) > 2_000_000) return err(413, "too_large", "Too much text.");
  const parsed = partnerJobSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return err(400, "bad_request", "Invalid request.");
  const { instruction, filename, pages } = parsed.data;

  const route = routeInstruction(instruction);
  if (route.kind === "clarify") return err(422, "clarify", route.message);
  if (route.kind === "unsupported") return err(422, "unsupported", route.message);
  // Partners route file operations themselves; anything here is a reading task.
  const task = route.kind === "ai" ? route.task : "ask";

  try {
    const clean = checkPages(pages.map((p, i) => ({ n: i + 1, text: p.text.trim() })));
    if (!takePartnerQuota()) return err(429, "busy", "The AI is at capacity for today. Please try again tomorrow.");
    const { id, token } = await createJob({
      task,
      instruction,
      filename: filename.replace(/[^\w.\- ()]/g, "_").slice(0, 120) || "document.pdf",
      pages: clean,
    });
    after(() => drain());
    return NextResponse.json({ id, token }, { status: 201 });
  } catch (e) {
    if (e instanceof ExtractError) return err(422, e.code, e.message);
    console.error("[partner] failed", e instanceof Error ? e.name : "unknown");
    return err(500, "internal", "Something went wrong on our side. Please try again.");
  }
}
