import Link from "next/link";
import { ArrowUpRight, type LucideIcon } from "lucide-react";

export default function ToolCard({
  title,
  description,
  href,
  icon: Icon,
}: {
  title: string;
  description: string;
  href: string;
  icon?: LucideIcon;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col justify-between rounded-[1.75rem] bg-[var(--surface-soft)] p-6 text-left transition-transform duration-200 hover:-translate-y-0.5 sm:p-7"
    >
      <div className="flex items-start justify-between">
        {Icon ? (
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-sm">
            <Icon size={19} strokeWidth={1.8} />
          </div>
        ) : null}
        <ArrowUpRight
          className="text-[var(--muted)] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
          size={18}
        />
      </div>
      <div className="mt-6">
        <h2 className="font-display text-lg font-semibold sm:text-xl">{title}</h2>
        <p className="mt-1.5 text-sm leading-6 text-[var(--muted)]">{description}</p>
      </div>
    </Link>
  );
}
