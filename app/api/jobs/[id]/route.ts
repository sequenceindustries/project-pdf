import { errorResponse, json, ready, visitor } from "@/lib/server/http";
import { getJobFiles, getOwnedJob } from "@/lib/server/jobs";
import { presentJob } from "@/lib/server/present";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await ready();
    const { id } = await ctx.params;
    const me = await visitor(false);
    const job = me ? await getOwnedJob(id, me.owner) : null;
    // Same response for "doesn't exist" and "not yours": no enumeration.
    if (!job) return json({ error: "Job not found." }, 404);
    return json(presentJob(job, await getJobFiles(job.id)));
  } catch (e) {
    return errorResponse(e, "GET /api/jobs/:id");
  }
}
