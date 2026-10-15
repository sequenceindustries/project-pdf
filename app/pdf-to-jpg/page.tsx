import type { Metadata } from "next";
import ToolPage from "@/components/ToolPage";
import { toolMetadata } from "@/lib/seo";
import PdfToJpgWorkspace from "./workspace";

export const metadata: Metadata = toolMetadata("pdf-to-jpg");

export default function Page() {
  return (
    <ToolPage slug="pdf-to-jpg">
      <PdfToJpgWorkspace />
    </ToolPage>
  );
}
