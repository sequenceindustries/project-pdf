import { describe, expect, it } from "vitest";
import { validateResult, toMarkdown } from "@/lib/server/validate";

const pages = [
  { n: 1, text: "The tenant shall pay rent of R10,000 monthly." },
  { n: 2, text: "Either party may terminate with 60 days written notice." },
];
const base = {
  headline: "Lease overview",
  summary: "A residential lease with monthly rent and a termination clause.",
  uncertainties: [],
  sensitive: true,
};

describe("validateResult", () => {
  it("verifies quotes against cited pages", () => {
    const r = validateResult(
      { ...base, points: [
        { text: "Rent is R10,000", pages: [1], quote: "pay rent of R10,000 monthly" },
        { text: "Made up", pages: [2], quote: "tenant must paint the walls" },
      ] },
      pages,
      "lease.pdf",
    );
    expect(r.points[0].verified).toBe(true);
    expect(r.points[1].verified).toBe(false);
    expect(toMarkdown(r, "summarise")).toContain("Verify before relying");
  });
  it("rejects out-of-range page references", () => {
    expect(() => validateResult({ ...base, points: [{ text: "x y z", pages: [9], quote: "abcdefghij" }] }, pages, "a.pdf")).toThrow();
  });
  it("rejects malformed output", () => {
    expect(() => validateResult({ headline: "x" }, pages, "a.pdf")).toThrow();
  });
});
