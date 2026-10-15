import ToolCard from "@/components/ToolCard";
import { tools, type Tool } from "@/lib/tools";

export default function ToolGrid({
  items = tools,
  headingLevel = "h3",
}: {
  items?: Tool[];
  headingLevel?: "h2" | "h3";
}) {
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2" role="list">
      {items.map((t) => (
        <li key={t.slug} className="flex">
          <ToolCard
            title={t.name}
            description={t.card}
            href={`/${t.slug}`}
            icon={t.Icon}
            headingLevel={headingLevel}
          />
        </li>
      ))}
    </ul>
  );
}
