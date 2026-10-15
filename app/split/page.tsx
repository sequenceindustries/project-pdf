import type { Metadata } from "next";
import ToolPage from "@/components/ToolPage";
import { toolMetadata } from "@/lib/seo";
import SplitWorkspace from "./workspace";

export const metadata: Metadata = toolMetadata("split");

export default function Page() {
  return (
    <ToolPage slug="split">
      <SplitWorkspace />
    </ToolPage>
  );
}
