import type { Metadata } from "next";
import RotateWorkspace from "./workspace";

export const metadata: Metadata = {
  title: "Rotate PDF pages online, free",
  description: "Rotate every page of a PDF in your browser. Nothing is uploaded.",
  alternates: { canonical: "/rotate" },
};

export default function Page() {
  return <RotateWorkspace />;
}
