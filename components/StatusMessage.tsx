export default function StatusMessage({
  type = "error",
  children,
}: {
  type?: "error" | "success";
  children?: React.ReactNode;
}) {
  if (!children) return null;
  const styles =
    type === "error"
      ? "bg-red-50 text-red-700"
      : "bg-[var(--success-bg)] text-[var(--success)]";
  return <p className={`mt-4 rounded-xl p-3 text-sm ${styles}`}>{children}</p>;
}
