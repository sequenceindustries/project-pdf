import { test } from "node:test";
import assert from "node:assert/strict";
import { rulePlan } from "../lib/engine/rule-planner";
import { PlanSchema, validatePlan, deliverableSteps, type FileInfo } from "../lib/engine/plan";

const one: FileInfo[] = [{ n: 1, kind: "pdf", pages: 12 }];
const two: FileInfo[] = [
  { n: 1, kind: "pdf", pages: 3 },
  { n: 2, kind: "pdf", pages: 4 },
];
const opts = { maxSteps: 8, maxAiPages: 150, aiAvailable: true };

function plan(instr: string, files = one) {
  const r = rulePlan(instr, files);
  assert.equal(r.complete, true, `expected complete plan for "${instr}" (${!r.complete ? r.reason : ""})`);
  return r.complete ? r.plan : null!;
}

test("remove pages then compress (the brief's example)", () => {
  const p = plan("Remove pages 5–8 and compress the remaining document.");
  assert.deepEqual(p.steps, [
    { tool: "remove_pages", pages: "5-8", inputs: ["file:1"] },
    { tool: "compress", level: "recommended", inputs: ["step:1"] },
  ]);
  assert.ok(PlanSchema.safeParse(p).success);
  assert.deepEqual(validatePlan(p, one, opts), { ok: true, aiPages: 0, usesAi: false });
  assert.deepEqual([...deliverableSteps(p)], [1]);
});

test("common single operations", () => {
  assert.equal(plan("merge these PDFs", two).steps[0].tool, "merge");
  assert.deepEqual(plan("delete pages 2 and 4").steps[0], { tool: "remove_pages", pages: "2,4", inputs: ["file:1"] });
  assert.deepEqual(plan("keep only pages 1 to 3").steps[0], { tool: "extract_pages", pages: "1-3", inputs: ["file:1"] });
  assert.deepEqual(plan("rotate page 3 left").steps[0], { tool: "rotate", angle: 270, pages: "3", inputs: ["file:1"] });
  assert.deepEqual(plan("turn it upside down").steps[0], { tool: "rotate", angle: 180, inputs: ["file:1"] });
  assert.deepEqual(plan("make it as small as possible").steps[0], { tool: "compress", level: "strong", inputs: ["file:1"] });
  assert.deepEqual(plan("reverse the page order").steps[0], { tool: "reorder_pages", order: "reverse", inputs: ["file:1"] });
  assert.deepEqual(plan("convert to JPG").steps[0], { tool: "pdf_to_images", inputs: ["file:1"] });
  assert.deepEqual(plan("extract the text").steps[0], { tool: "extract_text", inputs: ["file:1"] });
  assert.deepEqual(plan("turn these into a pdf", [{ n: 1, kind: "image", pages: 1 }]).steps[0], {
    tool: "images_to_pdf",
    inputs: ["file:1"],
  });
});

test("merge then compress chains", () => {
  const p = plan("Combine these, then compress", two);
  assert.deepEqual(p.steps.map((s) => s.tool), ["merge", "compress"]);
  assert.deepEqual(p.steps[1].inputs, ["step:1"]);
});

test("AI intents and unclear text defer to the AI planner", () => {
  for (const s of [
    "Summarise this document",
    "What are the payment terms?",
    "Extract invoice numbers, dates and totals into Excel",
    "Explain clause 4 in simple language",
    "do the thing",
  ]) {
    assert.equal(rulePlan(s, one).complete, false, s);
  }
  for (const s of ["Summarise this document", "Explain clause 4", "Translate to English", "Compare these"]) {
    const r = rulePlan(s, two);
    assert.equal(!r.complete && r.reason, "needs_ai", s);
  }
});

test("validation catches impossible plans with clear messages", () => {
  const bad = (p: unknown, files = one, o = opts) => {
    const v = validatePlan(PlanSchema.parse(p), files, o);
    assert.equal(v.ok, false);
    return (v as { error: string }).error;
  };
  assert.match(bad({ steps: [{ tool: "remove_pages", inputs: ["file:1"], pages: "10-20" }] }), /don't exist.*12 pages/);
  assert.match(bad({ steps: [{ tool: "remove_pages", inputs: ["file:1"], pages: "1-12" }] }), /empty/);
  assert.match(bad({ steps: [{ tool: "compress", inputs: ["file:3"], level: "light" }] }), /file 3/);
  assert.match(bad({ steps: [{ tool: "merge", inputs: ["file:1"] }] }), /at least two/);
  assert.match(bad({ steps: [{ tool: "compress", inputs: ["step:1"], level: "light" }] }), /isn't available/);
  assert.match(
    bad({ steps: [{ tool: "analyze", inputs: ["file:1"], mode: "summary" }] }, one, { ...opts, aiAvailable: false }),
    /isn't switched on/
  );
  assert.match(bad({ steps: [{ tool: "analyze", inputs: ["file:1"], mode: "summary" }] }, [{ n: 1, kind: "pdf", pages: 2, scanned: true }]), /OCR/);
  assert.match(bad({ steps: [{ tool: "rotate", inputs: ["file:1"], angle: 90 }] }, [{ n: 1, kind: "pdf", pages: 2, encrypted: true }]), /password/);
  assert.match(bad({ steps: [{ tool: "analyze", inputs: ["file:1"], mode: "summary" }] }, [{ n: 1, kind: "pdf", pages: 400 }]), /limited to 150 pages/);
  // Page counts are tracked through steps: after removing 5-8 from 12 pages, page 10 no longer exists.
  assert.match(
    bad({
      steps: [
        { tool: "remove_pages", inputs: ["file:1"], pages: "5-8" },
        { tool: "extract_pages", inputs: ["step:1"], pages: "10" },
      ],
    }),
    /8 pages/
  );
});

test("schema rejects tools and arguments outside the contract", () => {
  assert.equal(PlanSchema.safeParse({ steps: [{ tool: "shell", inputs: ["file:1"], cmd: "rm -rf /" }] }).success, false);
  assert.equal(PlanSchema.safeParse({ steps: [{ tool: "rotate", inputs: ["file:1"], angle: 45 }] }).success, false);
  assert.equal(PlanSchema.safeParse({ steps: [{ tool: "merge", inputs: ["../etc/passwd"] }] }).success, false);
  assert.equal(PlanSchema.safeParse({ steps: Array(9).fill({ tool: "extract_text", inputs: ["file:1"] }) }).success, false);
});
