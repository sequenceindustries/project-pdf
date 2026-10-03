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
import PdfStack from "@/components/PdfStack";

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

      <section className="mx-auto grid max-w-5xl grid-cols-1 items-center gap-10 px-4 pb-16 pt-14 sm:px-6 sm:pb-24 sm:pt-20 md:grid-cols-2 md:gap-6">
        <div className="text-center md:text-left">
          <h1 className="font-display mx-auto max-w-md text-5xl font-extrabold leading-[1.05] sm:text-6xl md:mx-0">
            PDFs, without the headache.
          </h1>
          <p className="mx-auto mt-5 max-w-sm text-base leading-7 text-[var(--muted)] sm:text-lg md:mx-0">
            Simple tools for merging, splitting, compressing, converting and managing your PDFs.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3 md:justify-start">
            <a href="#tools" className="btn btn-primary px-7 py-3.5 text-base">
              Choose a tool
            </a>
            <a href="#how" className="btn btn-outline px-7 py-3.5 text-base">
              How it works
            </a>
          </div>
        </div>
        <PdfStack />
      </section>

      <section id="tools" className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {tools.map(({ title, description, href, Icon }) => (
            <ToolCard key={title} title={title} description={description} href={href} icon={Icon} />
          ))}
        </div>
      </section>

      <section id="how" className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-20">
        <h2 className="font-display text-center text-3xl font-extrabold sm:text-4xl">How it works</h2>
        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            { step: "1", title: "Drop a file", body: "Drag your PDF or image in, or click to browse." },
            { step: "2", title: "Pick a tool", body: "Merge, split, compress, convert — whatever you need." },
            { step: "3", title: "Download", body: "Your file never leaves the browser. Nothing is uploaded." },
          ].map((s) => (
            <div key={s.step} className="card-chunky p-6 text-center">
              <div className="btn btn-primary mx-auto h-9 w-9 p-0 text-sm">{s.step}</div>
              <h3 className="font-display mt-4 text-lg font-bold">{s.title}</h3>
              <p className="mt-1.5 text-sm leading-6 text-[var(--muted)]">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-[var(--dark-bg)] px-4 py-20 text-white sm:px-6 sm:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <div className="chip mx-auto w-fit bg-[var(--dark-surface)] px-3.5 py-1.5 text-[var(--dark-muted)]" style={{ borderColor: "var(--dark-border)" }}>
            <Sparkles size={13} />
            Coming next
          </div>
          <h2 className="font-display mt-6 text-3xl font-extrabold leading-tight sm:text-4xl md:text-5xl">
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
