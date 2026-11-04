import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/partner/jobs/route";
import { setAiProvider } from "@/lib/server/ai";
import { resetPartnerQuota } from "@/lib/server/partner";
import * as jobs from "@/lib/server/jobs";
import { freshDb } from "./helpers";

vi.mock("next/server", async (orig) => ({ ...(await orig<typeof import("next/server")>()), after: () => {} }));

const KEY = "k".repeat(40);
const body = { instruction: "Summarise this", filename: "x.pdf", pages: [{ n: 1, text: "Payment is due within 30 days of the invoice date." }] };
const call = (b: unknown, auth = `Bearer ${KEY}`) =>
  POST(new Request("http://x/api/partner/jobs", { method: "POST", headers: { authorization: auth, "content-type": "application/json" }, body: JSON.stringify(b) }));

beforeEach(async () => {
  await freshDb();
  resetPartnerQuota();
  process.env.PARTNER_API_KEY = KEY;
  process.env.DATABASE_URL = "postgres://test";
  setAiProvider({ run: async () => { throw new Error("unused"); } });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("partner api", () => {
  it("rejects a wrong key", async () => {
    expect((await call(body, "Bearer nope")).status).toBe(401);
  });
  it("is hidden when no key is configured", async () => {
    delete process.env.PARTNER_API_KEY;
    expect((await call(body)).status).toBe(404);
  });
  it("creates a job from text", async () => {
    const r = await call(body);
    expect(r.status).toBe(201);
    const { id, token } = await r.json();
    const j = await jobs.getJob(id, token);
    expect(j?.task).toBe("summarise");
  });
  it("rejects near-empty (scanned) text", async () => {
    const r = await call({ ...body, pages: [{ n: 1, text: "hi" }] });
    expect(r.status).toBe(422);
    expect((await r.json()).error.code).toBe("scanned");
  });
  it("enforces the daily cap", async () => {
    process.env.PEEDF_PARTNER_DAILY_CAP = "1";
    expect((await call(body)).status).toBe(201);
    expect((await call(body)).status).toBe(429);
    delete process.env.PEEDF_PARTNER_DAILY_CAP;
  });
});
