import Link from "next/link";
import { ArrowRight, type LucideIcon } from "lucide-react";

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
      className="card-chunky group flex flex-col justify-between p-6 text-left transition-transform duration-150 hover:-translate-y-0.5 sm:p-7"
    >
      <div className="flex items-start justify-between">
        {Icon ? (
          <div className="flex h-11 w-11 items-center justify-center rounded-[0.85rem] border-2 border-[var(--accent-dark)] bg-[var(--accent-soft)]">
            <Icon size={19} strokeWidth={2} className="text-[var(--accent-dark)]" />
          </div>
        ) : null}
        <ArrowRight
          className="text-[var(--muted)] transition-transform group-hover:translate-x-1"
          size={18}
        />
      </div>
      <div className="mt-6">
        <h2 className="font-display text-lg font-bold sm:text-xl">{title}</h2>
        <p className="mt-1.5 text-sm leading-6 text-[var(--muted)]">{description}</p>
      </div>
    </Link>
  );
}
