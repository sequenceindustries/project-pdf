/**
 * Worker-thread entry point. Receives one operation, runs it, posts the
 * result, and is then terminated by the host. Nothing here can reach the
 * network, database or filesystem beyond the module code it imports.
 */
import { parentPort } from "node:worker_threads";
import * as ops from "./ops";
import type { SandboxRequest } from "./sandbox-types";

if (!parentPort) throw new Error("sandbox-thread must run as a worker");

// Defence in depth: the sandbox has no business making network requests.
globalThis.fetch = (() => Promise.reject(new Error("network disabled in sandbox"))) as typeof fetch;

parentPort.on("message", async (req: SandboxRequest) => {
  try {
    const result = await run(req);
    const transfer = collectBuffers(result);
    parentPort!.postMessage({ ok: true, result }, transfer);
  } catch (e) {
    const code = e instanceof ops.OpError ? e.code : "processing_error";
    const message =
      e instanceof ops.OpError ? e.message : "The document couldn't be processed. It may be damaged or use unsupported features.";
    parentPort!.postMessage({ ok: false, code, message, detail: e instanceof Error ? e.message.slice(0, 300) : undefined });
  }
});

async function run(req: SandboxRequest): Promise<unknown> {
  const [first] = req.inputs;
  switch (req.op) {
    case "inspect":
      return ops.inspect(first);
    case "merge":
      return ops.merge(req.inputs);
    case "extract_pages":
      return ops.extractPages(first, String(req.args.pages));
    case "remove_pages":
      return ops.removePages(first, String(req.args.pages));
    case "reorder_pages":
      return ops.reorderPages(first, String(req.args.order));
    case "rotate":
      return ops.rotate(first, Number(req.args.angle), req.args.pages ? String(req.args.pages) : undefined);
    case "compress":
      return ops.compress(first, (req.args.level as "light" | "recommended" | "strong") ?? "recommended");
    case "pdf_to_images":
      return ops.pdfToImages(first, req.args.pages ? String(req.args.pages) : undefined);
    case "images_to_pdf":
      return ops.imagesToPdf(req.inputs);
    case "extract_text":
      return ops.extractText(first);
    case "text_pages":
      return ops.extractTextPages(first);
    case "render_report":
      return ops.renderReport(String(req.args.title), String(req.args.markdown), String(req.args.footer));
    case "render_table":
      return ops.renderTable(
        req.args.format as "csv" | "xlsx",
        req.args.columns as string[],
        req.args.rows as string[][],
        String(req.args.name)
      );
    case "validate":
      return ops.validateOutput(first, (req.args.expect as { pages?: number }) ?? {});
    default:
      throw new ops.OpError("unknown_op", "Unknown operation.");
  }
}

function collectBuffers(v: unknown): ArrayBuffer[] {
  const out: ArrayBuffer[] = [];
  const visit = (x: unknown) => {
    if (x instanceof Uint8Array) {
      if (x.byteOffset === 0 && x.byteLength === x.buffer.byteLength && x.buffer instanceof ArrayBuffer) out.push(x.buffer);
    } else if (Array.isArray(x)) x.forEach(visit);
    else if (x && typeof x === "object") Object.values(x).forEach(visit);
  };
  visit(v);
  return [...new Set(out)];
}
