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

export default function Home() {
  return (
    <main className="min-h-screen">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl justify-between px-6 py-5">
          <Link href="/" className="text-xl font-bold">
            PDF<span className="text-[var(--accent)]">.</span>
          </Link>
          <Link href="/tools" className="text-sm text-[var(--muted)]">
            All tools
          </Link>
        </div>
      </header>
      <section className="mx-auto max-w-6xl px-6 py-20 text-center">
        <h1 className="mx-auto max-w-3xl text-5xl font-bold tracking-tight md:text-6xl">
          PDF tools without the clutter.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-[var(--muted)]">
          Merge, split, compress and convert documents quickly from one simple workspace.
        </p>
        <div className="mx-auto mt-12 grid max-w-5xl gap-4 md:grid-cols-2">
          {tools.map(({ title, description, href, Icon }) => (
            <ToolCard key={title} title={title} description={description} href={href} icon={Icon} />
          ))}
        </div>
      </section>
    </main>
  );
}
