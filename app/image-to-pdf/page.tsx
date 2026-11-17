import type { Metadata } from "next";
import ImageToPdfWorkspace from "./workspace";

export const metadata: Metadata = {
  title: "JPG to PDF converter, free",
  description: "Turn JPG and PNG images into a single PDF in your browser. Nothing is uploaded.",
  alternates: { canonical: "/image-to-pdf" },
};

export default function Page() {
  return <ImageToPdfWorkspace />;
}
