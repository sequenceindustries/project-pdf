import { describe, expect, it } from "vitest";
import { routeInstruction } from "@/lib/server/router";

describe("router", () => {
  it("asks to clarify empty input", () => expect(routeInstruction(" ").kind).toBe("clarify"));
  it("routes summaries to AI", () => expect(routeInstruction("Summarise this contract")).toEqual({ kind: "ai", task: "summarise" }));
  it("routes questions to AI", () => expect(routeInstruction("What is the termination notice period?")).toEqual({ kind: "ai", task: "ask" }));
  it("sends file ops to deterministic tools", () => {
    const r = routeInstruction("compress this PDF");
    expect(r).toMatchObject({ kind: "tool", href: "/compress" });
  });
  it("does not hijack questions that mention a tool word", () =>
    expect(routeInstruction("What does the document say about merge conditions?").kind).toBe("ai"));
  it("is honest about unsupported tasks", () => expect(routeInstruction("translate to French").kind).toBe("unsupported"));
});
