import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-[var(--dark-bg)] px-4 pb-10 pt-14 text-[var(--dark-muted)] sm:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="font-display text-5xl text-[var(--accent)] sm:text-7xl">peedf</div>
        <div className="mt-8 flex flex-col gap-6 border-t border-dotted border-[var(--dark-muted)] pt-6 text-sm sm:flex-row sm:items-start sm:justify-between">
          <p className="max-w-md leading-6">
            Browser tools never upload your files. AI workspace jobs process extracted text and expire automatically.
          </p>
          <div className="flex items-center gap-6">
            <Link href="/" className="transition-colors hover:text-white">AI workspace</Link>
            <Link href="/tools" className="transition-colors hover:text-white">Free tools</Link>
            <span>© {new Date().getFullYear()} peedf.com</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
