import { describe, expect, it } from "vitest";
import { extractPages, ExtractError } from "@/lib/server/extract";
import { makePdf } from "./helpers";

describe("extractPages", () => {
  it("extracts text per page", async () => {
    const pages = await extractPages(await makePdf(["First page has enough text to count as real.", "Second page also has enough text here."]));
    expect(pages).toHaveLength(2);
    expect(pages[1]).toMatchObject({ n: 2 });
    expect(pages[0].text).toContain("First page");
  });
  it("flags scanned/blank PDFs", async () => {
    await expect(extractPages(await makePdf(["", ""]))).rejects.toMatchObject({ code: "scanned" });
  });
  it("rejects non-PDFs", async () => {
    await expect(extractPages(new TextEncoder().encode("hello world"))).rejects.toBeInstanceOf(ExtractError);
  });
  it("rejects corrupt PDFs", async () => {
    await expect(extractPages(new TextEncoder().encode("%PDF-1.7 garbage"))).rejects.toMatchObject({ code: "encrypted_or_corrupt" });
  });
});
