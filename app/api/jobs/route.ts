import { config } from "@/lib/server/config";
import { emit } from "@/lib/server/events";
import { assertSameOrigin, clientIpHash, errorResponse, json, ready, visitor } from "@/lib/server/http";
import { checkCreateLimits, createJob, listOwnedJobs } from "@/lib/server/jobs";
import { readUploads } from "@/lib/server/uploads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Create a job: multipart form with `instruction` and one or more `files`. */
export async function POST(req: Request) {
  try {
    await ready();
    await assertSameOrigin();
    const me = (await visitor(true))!;
    const ip = await clientIpHash();
    await checkCreateLimits(me.owner, ip);
    // Reject oversized bodies before buffering them (multipart overhead allowance: 1 MB).
    const length = Number(req.headers.get("content-length") ?? NaN);
    if (!Number.isFinite(length)) return json({ error: "Upload size is required." }, 411);
    if (length > config.limits.maxJobBytes + 1024 * 1024) {
      return json({ error: `Files in one request can total up to ${Math.round(config.limits.maxJobBytes / 1048576)} MB.` }, 413);
    }
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return json({ error: "The upload didn't come through completely. Please try again." }, 400);
    }
    const { instruction, files } = await readUploads(form);
    const id = await createJob({ owner: me.owner, ip, instruction, files });
    emit("job_created", { job: id, files: files.length, bytes: files.reduce((n, f) => n + f.bytes.byteLength, 0) });
    return json({ id }, 201);
  } catch (e) {
    return errorResponse(e, "POST /api/jobs");
  }
}

/** The visitor's recent jobs (used to restore the workspace after a refresh). */
export async function GET() {
  try {
    await ready();
    const me = await visitor(false);
    if (!me) return json({ jobs: [] });
    const jobs = await listOwnedJobs(me.owner, 5);
    return json({
      jobs: jobs.map((j) => ({ id: j.id, status: j.status, createdAt: j.created_at, purged: Boolean(j.purged_at), instruction: j.instruction, files: j.files })),
    });
  } catch (e) {
    return errorResponse(e, "GET /api/jobs");
  }
}
