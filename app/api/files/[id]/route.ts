import { errorResponse, json, ready, visitor } from "@/lib/server/http";
import { getOwnedFile } from "@/lib/server/jobs";
import { verifyDownload } from "@/lib/server/session";
import { getBlob } from "@/lib/server/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Downloads require BOTH the visitor cookie that owns the job and an
 * unexpired signature bound to the file and owner (links expire after
 * DOWNLOAD_LINK_TTL_SECONDS and can't be used from another browser).
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await ready();
    const { id } = await ctx.params;
    const url = new URL(req.url);
    const exp = Number(url.searchParams.get("exp"));
    const sig = url.searchParams.get("sig") ?? "";
    const me = await visitor(false);
    if (!me || !verifyDownload(id, me.owner, exp, sig)) {
      return json({ error: "This download link has expired. Reopen the job to get a fresh link." }, 403);
    }
    const file = await getOwnedFile(id, me.owner);
    if (!file || !file.blob_id || file.purged_at) return json({ error: "This file has been deleted." }, 410);
    const data = await getBlob(file.blob_id);
    if (!data) return json({ error: "This file has been deleted." }, 410);
    const inline = url.searchParams.get("inline") === "1" && (file.mime === "application/pdf" || file.mime === "image/jpeg");
    const ascii = file.name.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "");
    return new Response(new Uint8Array(data), {
      headers: {
        "content-type": file.mime,
        "content-length": String(data.byteLength),
        "content-disposition": `${inline ? "inline" : "attachment"}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(file.name)}`,
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
        "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
        "x-robots-tag": "noindex",
      },
    });
  } catch (e) {
    return errorResponse(e, "GET /api/files/:id");
  }
}
