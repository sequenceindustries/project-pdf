/**
 * Always rendered so screen readers announce changes: errors via role="alert",
 * success/progress via a polite live region.
 */
export default function StatusMessage({
  type = "error",
  children,
}: {
  type?: "error" | "success";
  children?: React.ReactNode;
}) {
  const styles =
    type === "error"
      ? "bg-red-50 text-red-700"
      : "bg-[var(--success-bg)] text-[var(--success)]";
  return (
    <div role={type === "error" ? "alert" : "status"} aria-live={type === "error" ? "assertive" : "polite"}>
      {children ? <p className={`mt-4 rounded-xl p-3 text-sm ${styles}`}>{children}</p> : null}
    </div>
  );
}
