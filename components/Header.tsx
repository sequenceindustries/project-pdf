import Link from "next/link";

export default function Header() {
  return (
    <div className="sticky top-3 z-20 px-3 sm:top-4 sm:px-4">
      <header className="mx-auto flex max-w-3xl items-center justify-between rounded-[1.25rem] border-2 border-[var(--border)] bg-[var(--surface)]/95 px-4 py-2.5 backdrop-blur-md sm:px-5 sm:py-3">
        <Link href="/" className="font-display flex items-center gap-2 text-base font-extrabold sm:text-lg">
          <span className="flex h-7 w-7 items-center justify-center rounded-[0.6rem] border-2 border-[var(--accent-dark)] bg-[var(--accent)] text-xs text-white sm:h-8 sm:w-8">
            p
          </span>
          peedf
        </Link>
        <Link href="/tools" className="btn btn-dark px-4 py-2 text-sm sm:px-5">
          All tools
        </Link>
      </header>
    </div>
  );
}
