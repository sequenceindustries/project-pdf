import type { Metadata } from "next";
import ToolPage from "@/components/ToolPage";
import { toolMetadata } from "@/lib/seo";
import RotateWorkspace from "./workspace";

export const metadata: Metadata = toolMetadata("rotate");

export default function Page() {
  return (
    <ToolPage slug="rotate">
      <RotateWorkspace />
    </ToolPage>
  );
}
