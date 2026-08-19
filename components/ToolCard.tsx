import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function ToolCard({title,description,href}:{title:string;description:string;href:string}) {
  return (
    <Link href={href} className="group rounded-2xl border bg-white p-6 text-left shadow-sm hover:shadow-md">
      <div className="flex justify-between">
        <h2 className="text-xl font-semibold">{title}</h2>
        <ArrowRight className="text-gray-400 group-hover:translate-x-1" size={20}/>
      </div>
      <p className="mt-2 text-sm text-[var(--muted)]">{description}</p>
    </Link>
  );
}
