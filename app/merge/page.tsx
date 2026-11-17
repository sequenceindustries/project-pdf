import type { Metadata } from "next";
import MergeWorkspace from "./workspace";

export const metadata: Metadata = {
  title: "Merge PDF files online, free",
  description: "Combine several PDFs into one document in your browser. Nothing is uploaded.",
  alternates: { canonical: "/merge" },
};

export default function Page() {
  return <MergeWorkspace />;
}
