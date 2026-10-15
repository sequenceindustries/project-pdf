/**
 * Page-spec parsing shared by the planner and the executor.
 * Specs are 1-based and human-written: "5-8", "1, 3, 10-12", "last", "2-end".
 */

export type PageSpecResult = { ok: true; indices: number[] } | { ok: false; error: string };

const RANGE = /^(\d+|last|end)\s*(?:-|–|—|to)\s*(\d+|last|end)$/i;

function num(token: string, count: number) {
  const t = token.toLowerCase();
  if (t === "last" || t === "end") return count;
  return Number.parseInt(t, 10);
}

/** Returns sorted, de-duplicated 0-based indices, or a user-readable error. */
export function parsePageSpec(spec: string, count: number): PageSpecResult {
  const parts = spec
    .replace(/\band\b/gi, ",")
    .replace(/pages?/gi, "")
    .split(/[,;]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (!parts.length) return { ok: false, error: "No pages were given." };
  const out = new Set<number>();
  for (const p of parts) {
    const m = p.match(RANGE);
    if (m) {
      let a = num(m[1], count);
      let b = num(m[2], count);
      if (a > b) [a, b] = [b, a];
      if (a < 1 || b > count) return { ok: false, error: `Pages ${p} don't exist — this document has ${count} page${count === 1 ? "" : "s"}.` };
      for (let i = a; i <= b; i++) out.add(i - 1);
      continue;
    }
    if (/^(\d+|last)$/i.test(p)) {
      const n = num(p, count);
      if (n < 1 || n > count) return { ok: false, error: `Page ${p} doesn't exist — this document has ${count} page${count === 1 ? "" : "s"}.` };
      out.add(n - 1);
      continue;
    }
    return { ok: false, error: `"${p}" isn't a page number or range. Use something like 1-3, 5.` };
  }
  return { ok: true, indices: [...out].sort((a, b) => a - b) };
}

/**
 * Parses a full page order such as "3,1,2" or "reverse". Every page must
 * appear exactly once so reordering can never silently drop pages.
 */
export function parsePageOrder(spec: string, count: number): PageSpecResult {
  if (/^\s*reverse(d)?\s*$/i.test(spec)) {
    return { ok: true, indices: Array.from({ length: count }, (_, i) => count - 1 - i) };
  }
  const seq: number[] = [];
  for (const p of spec.split(/[,;\s]+/).filter(Boolean)) {
    const m = p.match(RANGE);
    if (m) {
      const a = num(m[1], count);
      const b = num(m[2], count);
      const step = a <= b ? 1 : -1;
      for (let i = a; step > 0 ? i <= b : i >= b; i += step) seq.push(i);
    } else if (/^(\d+|last)$/i.test(p)) {
      seq.push(num(p, count));
    } else {
      return { ok: false, error: `"${p}" isn't a page number.` };
    }
  }
  if (seq.some((n) => n < 1 || n > count)) return { ok: false, error: `The new order mentions pages outside 1–${count}.` };
  if (seq.length !== count || new Set(seq).size !== count) {
    return { ok: false, error: `List every page from 1 to ${count} exactly once, e.g. ${count >= 3 ? "3,1,2" : "2,1"}${count > 3 ? ",…" : ""}.` };
  }
  return { ok: true, indices: seq.map((n) => n - 1) };
}
