import type { Metadata } from "next";
import ToolPage from "@/components/ToolPage";
import { toolMetadata } from "@/lib/seo";
import ProtectWorkspace from "./workspace";

export const metadata: Metadata = toolMetadata("protect");

export default function Page() {
  return (
    <ToolPage slug="protect">
      <ProtectWorkspace />
    </ToolPage>
  );
}
