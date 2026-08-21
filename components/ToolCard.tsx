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
      className="group rounded-2xl border bg-white p-6 text-left shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex items-start justify-between">
        {Icon ? (
          <div className="rounded-xl bg-gray-100 p-3">
            <Icon size={22} />
          </div>
        ) : (
          <h2 className="text-xl font-semibold">{title}</h2>
        )}
        <ArrowRight
          className="text-gray-400 transition-transform group-hover:translate-x-1"
          size={20}
        />
      </div>
      {Icon && <h2 className="mt-6 text-xl font-semibold">{title}</h2>}
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{description}</p>
    </Link>
  );
}
