import type { Metadata } from "next";
import ToolPage from "@/components/ToolPage";
import { toolMetadata } from "@/lib/seo";
import MergeWorkspace from "./workspace";

export const metadata: Metadata = toolMetadata("merge");

export default function Page() {
  return (
    <ToolPage slug="merge">
      <MergeWorkspace />
    </ToolPage>
  );
}
