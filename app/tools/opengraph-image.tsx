import { ogSize, renderOg } from "@/lib/og";

export const alt = "All PDF tools — peedf";
export const size = ogSize;
export const contentType = "image/png";

export default function Image() {
  return renderOg({ title: "All PDF tools", subtitle: "Eight PDF tools that run on your own device." });
}
