import { NextResponse } from "next/server";
import { dbConfigured, q } from "@/lib/server/db";
import { aiConfigured } from "@/lib/server/ai";

export const dynamic = "force-dynamic";

export async function GET() {
  let db: "ok" | "unconfigured" | "error" = "unconfigured";
  if (dbConfigured()) {
    try {
      await q("SELECT 1");
      db = "ok";
    } catch {
      db = "error";
    }
  }
  return NextResponse.json({
    ok: true,
    service: "project-pdf",
    status: "operational",
    ai: { database: db, provider: aiConfigured() ? "configured" : "unconfigured" },
  });
}
