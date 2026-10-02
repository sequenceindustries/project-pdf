import {
  Combine,
  Scissors,
  Minimize2,
  ImagePlus,
  Stamp,
  RotateCw,
  ImageDown,
  Lock,
  Sparkles,
} from "lucide-react";
import Header from "@/components/Header";
import ToolCard from "@/components/ToolCard";
import Footer from "@/components/Footer";

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
      <div className="sky-wash">
        <Header />
        <section className="mx-auto max-w-4xl px-4 pb-16 pt-14 text-center sm:px-6 sm:pb-24 sm:pt-20">
          <h1 className="font-display mx-auto max-w-2xl text-5xl font-bold leading-[1.05] sm:text-6xl md:text-7xl">
            Your documents,
            <br />
            handled in the browser.
          </h1>
          <p className="mx-auto mt-6 max-w-lg text-base leading-7 text-[var(--muted)] sm:text-lg sm:leading-8">
            Merge, split, compress and convert PDFs without ever uploading a file to a server.
          </p>
          <div className="mt-9 flex items-center justify-center">
            <a
              href="#tools"
              className="pill bg-[var(--fg)] px-7 py-3.5 text-sm font-semibold text-white transition-opacity hover:opacity-85 sm:text-base"
            >
              Browse the tools
            </a>
          </div>
        </section>
      </div>

      <section id="tools" className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {tools.map(({ title, description, href, Icon }) => (
            <ToolCard key={title} title={title} description={description} href={href} icon={Icon} />
          ))}
        </div>
      </section>

      <section className="bg-[var(--dark-bg)] px-4 py-20 text-white sm:px-6 sm:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <div className="pill mx-auto flex w-fit items-center gap-2 border border-[var(--dark-border)] bg-[var(--dark-surface)] px-3.5 py-1.5 text-xs font-medium text-[var(--dark-muted)]">
            <Sparkles size={13} />
            Coming next
          </div>
          <h2 className="font-display mt-6 text-3xl font-bold leading-tight sm:text-4xl md:text-5xl">
            From file tools to a document
            <br className="hidden sm:block" /> you can talk to.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-[var(--dark-muted)] sm:text-lg">
            OCR, page-level editing and AI document chat are on the roadmap —
            the same browser-first, nothing-uploaded approach, applied further.
          </p>
        </div>
      </section>

      <Footer />
    </main>
  );
}
