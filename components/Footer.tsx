import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-[var(--dark-bg)] px-4 pb-10 pt-2 text-[var(--dark-muted)] sm:px-6">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 border-t border-[var(--dark-border)] pt-8 text-center sm:flex-row sm:justify-between sm:text-left">
        <div>
          <span className="font-display text-sm font-semibold text-white">peedf</span>
          <p className="mt-1 text-xs leading-5">
            Every tool runs in your browser. Files are never uploaded anywhere.
          </p>
        </div>
        <div className="flex items-center gap-5 text-xs">
          <Link href="/tools" className="transition-colors hover:text-white">
            All tools
          </Link>
          <span>© {new Date().getFullYear()} peedf.com</span>
        </div>
      </div>
    </footer>
  );
}
