import type { Metadata } from "next";
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
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "All tools",
  description: "Every PDF tool on peedf — merge, split, compress, convert, watermark and more.",
};

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

export default function Tools() {
  return (
    <main className="min-h-screen">
      <Header />
      <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-20">
        <h1 className="font-display text-4xl font-bold sm:text-5xl">All tools</h1>
        <p className="mt-3 text-[var(--muted)]">Eight ways to handle a PDF, all running on your device.</p>
        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {tools.map(({ title, description, href, Icon }) => (
            <ToolCard key={title} title={title} description={description} href={href} icon={Icon} />
          ))}
        </div>
      </div>
      <Footer />
    </main>
  );
}
