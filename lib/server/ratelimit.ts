const hits = new Map<string, number[]>();
/** In-memory per-IP limiter (single replica). Returns true if allowed. */
export function allow(key: string, limit = Number(process.env.PEEDF_JOBS_PER_HOUR) || 10, windowMs = 3_600_000) {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= limit) {
    hits.set(key, arr);
    return false;
  }
  arr.push(now);
  hits.set(key, arr);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
  return true;
}
export function resetRateLimit() {
  hits.clear();
}
