import type { Metadata } from "next";
import CompressWorkspace from "./workspace";

export const metadata: Metadata = {
  title: "Compress PDF online, free",
  description: "Shrink a PDF's file size in your browser. Nothing is uploaded.",
  alternates: { canonical: "/compress" },
};

export default function Page() {
  return <CompressWorkspace />;
}
