import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ToolGrid from "@/components/ToolGrid";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <>
      <Header />
      <main id="main" className="min-h-screen">
        <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-20">
          <h1 className="font-display text-4xl font-extrabold sm:text-5xl">This page doesn&apos;t exist</h1>
          <p className="mt-3 text-[var(--muted)]">
            The link may be old or mistyped. Pick a tool below, or{" "}
            <Link href="/" className="font-semibold underline">
              go to the homepage
            </Link>
            .
          </p>
          <div className="mt-10">
            <ToolGrid headingLevel="h2" />
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
