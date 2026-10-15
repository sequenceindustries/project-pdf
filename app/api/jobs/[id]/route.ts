import { NextResponse, after } from "next/server";
import { toDto } from "@/lib/server/dto";
import { drain, sweep } from "@/lib/server/engine";
import { getJob } from "@/lib/server/jobs";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await getJob(id, req.headers.get("x-job-token") ?? "").catch(() => null);
  if (!job) return NextResponse.json({ error: { code: "not_found", message: "This job doesn't exist or has expired." } }, { status: 404 });
  // Polling doubles as a safety net: recover stranded jobs and keep the queue moving.
  if (job.status === "queued" || job.status === "processing") after(() => sweep().catch(() => {}));
  return NextResponse.json(toDto(job));
}
