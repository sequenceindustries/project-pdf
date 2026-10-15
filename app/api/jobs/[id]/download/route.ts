import { NextResponse } from "next/server";
import { getJob } from "@/lib/server/jobs";
import { toMarkdown, type DocResult } from "@/lib/server/validate";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await getJob(id, req.headers.get("x-job-token") ?? "").catch(() => null);
  if (!job || job.status !== "completed" || !job.result)
    return NextResponse.json({ error: { code: "not_found", message: "No result available." } }, { status: 404 });
  const base = job.filename.replace(/\.pdf$/i, "") || "document";
  return new NextResponse(toMarkdown(job.result as DocResult, job.instruction), {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "content-disposition": `attachment; filename="${base}-peedf.md"`,
      "cache-control": "no-store",
    },
  });
}
