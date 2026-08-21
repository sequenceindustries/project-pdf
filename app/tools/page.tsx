import Link from "next/link";
import { Combine, Scissors, Minimize2, ImagePlus } from "lucide-react";
import ToolCard from "@/components/ToolCard";

const tools = [
  {
    title: "Merge PDF",
    description: "Combine multiple PDFs into one document.",
    href: "/merge",
    Icon: Combine,
  },
  {
    title: "Split PDF",
    description: "Extract pages or ranges from a PDF.",
    href: "/split",
    Icon: Scissors,
  },
  {
    title: "Compress PDF",
    description: "Optimize PDF structure in your browser.",
    href: "/compress",
    Icon: Minimize2,
  },
  {
    title: "JPG to PDF",
    description: "Turn images into a PDF.",
    href: "/image-to-pdf",
    Icon: ImagePlus,
  },
] as const;

export default function Tools() {
  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-5xl px-6 py-16">
        <Link href="/" className="text-xl font-bold">
          PDF<span className="text-[var(--accent)]">.</span>
        </Link>
        <h1 className="mt-14 text-4xl font-bold">All PDF tools</h1>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {tools.map(({ title, description, href, Icon }) => (
            <ToolCard key={title} title={title} description={description} href={href} icon={Icon} />
          ))}
        </div>
      </div>
    </main>
  );
}
