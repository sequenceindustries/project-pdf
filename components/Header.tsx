import Link from "next/link";

export default function Header() {
  return (
    <div className="sticky top-3 z-20 px-3 sm:top-4 sm:px-6">
      <header className="mx-auto flex max-w-5xl items-center justify-between rounded-full bg-[var(--surface)]/95 py-2 pl-5 pr-2 backdrop-blur-md sm:pl-6">
        <div className="flex items-center gap-4 sm:gap-5">
          <Link href="/" className="font-display text-2xl text-[var(--accent)]" aria-label="peedf home">
            peedf
          </Link>
          <span aria-hidden className="dotted-l hidden h-6 sm:block" />
          <nav className="hidden items-center gap-5 text-sm font-medium sm:flex">
            <Link href="/#how" className="hover:text-[var(--accent-dark)]">How it works</Link>
            <Link href="/tools" className="hover:text-[var(--accent-dark)]">Free tools</Link>
          </nav>
        </div>
        <Link href="/workspace" className="btn btn-primary px-5 py-2.5 text-sm">
          Open workspace
        </Link>
      </header>
    </div>
  );
}
