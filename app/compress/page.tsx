import type { Metadata } from "next";
import ToolPage from "@/components/ToolPage";
import { toolMetadata } from "@/lib/seo";
import CompressWorkspace from "./workspace";

export const metadata: Metadata = toolMetadata("compress");

export default function Page() {
  return (
    <ToolPage slug="compress">
      <CompressWorkspace />
    </ToolPage>
  );
}
