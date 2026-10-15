export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || !process.env.DATABASE_URL) return;
  const { sweep } = await import("./lib/server/engine");
  const tick = () => sweep().catch(() => {});
  setTimeout(tick, 3000); // pick up jobs stranded by a restart
  setInterval(tick, 60_000).unref?.();
}
