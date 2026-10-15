import { NextResponse, after } from "next/server";
import { aiConfigured } from "@/lib/server/ai";
import { dbConfigured } from "@/lib/server/db";
import { extractPages, ExtractError, MAX_UPLOAD_BYTES } from "@/lib/server/extract";
import { createJob } from "@/lib/server/jobs";
import { drain } from "@/lib/server/engine";
import { allow } from "@/lib/server/ratelimit";
import { routeInstruction } from "@/lib/server/router";

export const runtime = "nodejs";
export const maxDuration = 60;

const err = (status: number, code: string, message: string, extra: object = {}) =>
  NextResponse.json({ error: { code, message }, ...extra }, { status });

export async function POST(req: Request) {
  if (!dbConfigured() || !aiConfigured())
    return err(503, "not_configured", "The AI workspace isn't switched on yet. Please try again later.");

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  if (!allow(ip)) return err(429, "rate_limited", "You've reached the hourly limit for AI jobs. Please try again later.");

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return err(400, "bad_request", "Couldn't read the upload.");
  }
  const file = form.get("file");
  const instruction = String(form.get("instruction") ?? "").trim().slice(0, 1000);
  if (!(file instanceof File)) return err(400, "no_file", "Choose a PDF to upload.");
  if (file.size > MAX_UPLOAD_BYTES) return err(413, "too_large", "That file is over the 20 MB limit for AI analysis.");

  const route = routeInstruction(instruction);
  if (route.kind === "clarify") return err(422, "clarify", route.message);
  if (route.kind === "unsupported") return err(422, "unsupported", route.message);
  if (route.kind === "tool")
    return err(422, "use_tool", route.message, { tool: { name: route.tool, href: route.href } });

  try {
    const pages = await extractPages(new Uint8Array(await file.arrayBuffer()));
    const { id, token } = await createJob({
      task: route.task,
      instruction,
      filename: file.name.replace(/[^\w.\- ()]/g, "_").slice(0, 120) || "document.pdf",
      pages,
    });
    after(() => drain());
    return NextResponse.json({ id, token }, { status: 201 });
  } catch (e) {
    if (e instanceof ExtractError) return err(422, e.code, e.message);
    console.error("[upload] failed", e instanceof Error ? e.name : "unknown");
    return err(500, "internal", "Something went wrong on our side. Please try again.");
  }
}
