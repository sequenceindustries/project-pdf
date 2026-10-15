import { expect, it } from "vitest";
import { allow, resetRateLimit } from "@/lib/server/ratelimit";
it("limits per key", () => {
  resetRateLimit();
  expect([1, 2, 3].map(() => allow("a", 2))).toEqual([true, true, false]);
  expect(allow("b", 2)).toBe(true);
});
