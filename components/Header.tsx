import Link from "next/link";

export default function Header() {
  return (
    <header className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--surface)]/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6 sm:py-5">
        <Link href="/" className="font-display text-lg font-bold sm:text-xl">
          PDF<span className="text-[var(--accent)]">.</span>
        </Link>
        <Link
          href="/tools"
          className="text-sm text-[var(--muted)] transition-colors hover:text-[var(--fg)]"
        >
          All tools
        </Link>
      </div>
    </header>
  );
}
