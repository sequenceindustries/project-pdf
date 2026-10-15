import Link from "next/link";
import { ConsentSettingsButton } from "@/components/Analytics";
import { tools } from "@/lib/tools";

export default function Footer() {
  return (
    <footer className="bg-[var(--dark-bg)] px-4 pb-10 pt-12 text-[var(--dark-muted)] sm:px-6">
      <div className="mx-auto max-w-5xl">
        <nav aria-label="PDF tools" className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
          {tools.map((t) => (
            <Link key={t.slug} href={`/${t.slug}`} className="py-1 transition-colors hover:text-white">
              {t.name}
            </Link>
          ))}
        </nav>
        <div className="mt-10 flex flex-col items-center gap-4 border-t border-[var(--dark-border)] pt-8 text-center sm:flex-row sm:justify-between sm:text-left">
          <div>
            <span className="font-display text-sm font-extrabold text-white">peedf</span>
            <p className="mt-1 max-w-md text-xs leading-5">
              Single tools run in your browser and never upload files. The workspace processes files on
              our servers and deletes them after 24 hours.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs">
            <Link href="/tools" className="transition-colors hover:text-white">
              All tools
            </Link>
            <Link href="/privacy" className="transition-colors hover:text-white">
              Privacy
            </Link>
            <ConsentSettingsButton className="transition-colors hover:text-white" />
            <span>© {new Date().getFullYear()} peedf.com</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
