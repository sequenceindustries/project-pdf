import { config } from "@/lib/server/config";
import { assertSameOrigin, clientIpHash, errorResponse, json, ready, visitor } from "@/lib/server/http";
import { checkCreateLimits, reviseInstruction } from "@/lib/server/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Run a new instruction on the files already uploaded for this job. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await ready();
    await assertSameOrigin();
    const { id } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as { instruction?: unknown };
    const instruction = String(body.instruction ?? "").trim();
    if (!instruction) return json({ error: "Tell Peedf what you'd like to do." }, 400);
    if (instruction.length > config.limits.maxInstructionChars) return json({ error: "That instruction is too long." }, 400);
    const me = await visitor(false);
    if (!me) return json({ error: "These files are no longer available. Please upload them again." }, 409);
    const ip = await clientIpHash();
    // A re-run is a new run: the same limits apply as for a new upload.
    await checkCreateLimits(me.owner, ip);
    const ok = await reviseInstruction(id, me.owner, ip, instruction);
    if (!ok) return json({ error: "These files are no longer available. Please upload them again." }, 409);
    return json({ id });
  } catch (e) {
    return errorResponse(e, "POST /api/jobs/:id/instruction");
  }
}
