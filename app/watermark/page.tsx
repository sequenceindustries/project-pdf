import type { Metadata } from "next";
import ToolPage from "@/components/ToolPage";
import { toolMetadata } from "@/lib/seo";
import WatermarkWorkspace from "./workspace";

export const metadata: Metadata = toolMetadata("watermark");

export default function Page() {
  return (
    <ToolPage slug="watermark">
      <WatermarkWorkspace />
    </ToolPage>
  );
}
