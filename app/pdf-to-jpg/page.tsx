import type { Metadata } from "next";
import PdfToJpgWorkspace from "./workspace";

export const metadata: Metadata = {
  title: "PDF to JPG converter, free",
  description: "Export each page of a PDF as a JPG image in your browser. Nothing is uploaded.",
  alternates: { canonical: "/pdf-to-jpg" },
};

export default function Page() {
  return <PdfToJpgWorkspace />;
}
