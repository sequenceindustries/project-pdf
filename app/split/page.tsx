import type { Metadata } from "next";
import SplitWorkspace from "./workspace";

export const metadata: Metadata = {
  title: "Split PDF and extract pages, free",
  description: "Pull pages or page ranges out of a PDF in your browser. Nothing is uploaded.",
  alternates: { canonical: "/split" },
};

export default function Page() {
  return <SplitWorkspace />;
}
