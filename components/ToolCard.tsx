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
      className="group rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 text-left shadow-sm transition-shadow hover:shadow-md sm:p-6"
    >
      <div className="flex items-start justify-between">
        {Icon ? (
          <div
            className="rounded-xl bg-gray-100 p-3"
            style={{
              boxShadow:
                "4px 4px 0 -2px var(--border), 4px 4px 0 0 var(--surface), 8px 8px 0 -4px var(--border)",
            }}
          >
            <Icon size={20} />
          </div>
        ) : (
          <h2 className="font-display text-lg font-semibold sm:text-xl">{title}</h2>
        )}
        <ArrowRight
          className="text-gray-400 transition-transform group-hover:translate-x-1"
          size={20}
        />
      </div>
      {Icon && <h2 className="font-display mt-6 text-lg font-semibold sm:text-xl">{title}</h2>}
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{description}</p>
    </Link>
  );
}
