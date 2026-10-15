import { NextResponse } from "next/server";
import { cancel, getJob } from "@/lib/server/jobs";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await getJob(id, req.headers.get("x-job-token") ?? "").catch(() => null);
  if (!job) return NextResponse.json({ error: { code: "not_found", message: "Job not found." } }, { status: 404 });
  return NextResponse.json({ cancelled: await cancel(id) });
}
