import { emit } from "@/lib/server/events";
import { assertSameOrigin, errorResponse, json, ready, visitor } from "@/lib/server/http";
import { requestCancel } from "@/lib/server/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await ready();
    await assertSameOrigin();
    const { id } = await ctx.params;
    const me = await visitor(false);
    const status = me ? await requestCancel(id, me.owner) : null;
    if (!status) return json({ error: "This job can't be cancelled." }, 409);
    emit("job_cancelled", { job: id, immediate: status === "cancelled" });
    return json({ status });
  } catch (e) {
    return errorResponse(e, "POST /api/jobs/:id/cancel");
  }
}
