import Link from "next/link";
import {
  Combine,
  Scissors,
  Minimize2,
  ImagePlus,
  Stamp,
  RotateCw,
  ImageDown,
  Lock,
} from "lucide-react";
import Header from "@/components/Header";
import ToolCard from "@/components/ToolCard";

const tools = [
  {
    title: "Compress PDF",
    description: "Shrink file size by recompressing pages.",
    href: "/compress",
    Icon: Minimize2,
  },
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
    title: "JPG to PDF",
    description: "Turn images into a PDF.",
    href: "/image-to-pdf",
    Icon: ImagePlus,
  },
  {
    title: "Watermark PDF",
    description: "Stamp text across every page.",
    href: "/watermark",
    Icon: Stamp,
  },
  {
    title: "Rotate PDF",
    description: "Rotate every page at once.",
    href: "/rotate",
    Icon: RotateCw,
  },
  {
    title: "PDF to JPG",
    description: "Export pages as JPG images.",
    href: "/pdf-to-jpg",
    Icon: ImageDown,
  },
  {
    title: "Password Protect",
    description: "Encrypt a PDF with a password.",
    href: "/protect",
    Icon: Lock,
  },
] as const;

export default function Home() {
  return (
    <main className="min-h-screen">
      <Header />
      <section className="mx-auto max-w-6xl px-4 py-14 text-center sm:px-6 sm:py-20">
        <h1 className="font-display mx-auto max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
          PDF tools without the clutter.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-[var(--muted)] sm:text-lg sm:leading-8">
          Merge, split, compress and convert documents quickly from one simple workspace.
        </p>
        <div className="mx-auto mt-10 grid max-w-5xl grid-cols-1 gap-4 sm:mt-12 sm:grid-cols-2">
          {tools.map(({ title, description, href, Icon }) => (
            <ToolCard key={title} title={title} description={description} href={href} icon={Icon} />
          ))}
        </div>
      </section>
    </main>
  );
}
