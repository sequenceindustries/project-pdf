import type { Metadata } from "next";
import WatermarkWorkspace from "./workspace";

export const metadata: Metadata = {
  title: "Add a watermark to a PDF, free",
  description: "Stamp text across every page of a PDF in your browser. Nothing is uploaded.",
  alternates: { canonical: "/watermark" },
};

export default function Page() {
  return <WatermarkWorkspace />;
}
