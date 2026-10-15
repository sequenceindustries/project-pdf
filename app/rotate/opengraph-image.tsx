import { ogSize, renderOg } from "@/lib/og";
import { getTool } from "@/lib/tools";

const tool = getTool("rotate");
export const alt = `${tool.name} — peedf`;
export const size = ogSize;
export const contentType = "image/png";

export default function Image() {
  return renderOg({ title: tool.name, subtitle: tool.lead });
}
