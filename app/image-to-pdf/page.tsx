import type { Metadata } from "next";
import ToolPage from "@/components/ToolPage";
import { toolMetadata } from "@/lib/seo";
import ImageToPdfWorkspace from "./workspace";

export const metadata: Metadata = toolMetadata("image-to-pdf");

export default function Page() {
  return (
    <ToolPage slug="image-to-pdf">
      <ImageToPdfWorkspace />
    </ToolPage>
  );
}
