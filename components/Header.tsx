import Link from "next/link";

export default function Header() {
  return (
    <div className="sticky top-3 z-20 px-3 sm:top-4 sm:px-4">
      <header className="mx-auto flex max-w-3xl items-center justify-between rounded-full border border-[var(--border)] bg-[var(--surface)]/90 px-4 py-2.5 shadow-[0_1px_2px_rgba(16,20,30,0.04),0_8px_24px_rgba(16,20,30,0.06)] backdrop-blur-md sm:px-5 sm:py-3">
        <Link href="/" className="font-display flex items-center gap-1.5 text-base font-bold sm:text-lg">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--fg)] text-[11px] text-white sm:h-7 sm:w-7 sm:text-xs">
            P
          </span>
          peedf
        </Link>
        <Link
          href="/tools"
          className="pill bg-[var(--fg)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-85 sm:px-5"
        >
          All tools
        </Link>
      </header>
    </div>
  );
}
