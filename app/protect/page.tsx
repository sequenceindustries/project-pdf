import type { Metadata } from "next";
import ProtectWorkspace from "./workspace";

export const metadata: Metadata = {
  title: "Password protect a PDF, free",
  description: "Encrypt a PDF with a password in your browser. Nothing is uploaded.",
  alternates: { canonical: "/protect" },
};

export default function Page() {
  return <ProtectWorkspace />;
}
