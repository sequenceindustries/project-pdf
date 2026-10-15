import { ogSize, renderOg } from "@/lib/og";

export const alt = "Privacy notice — peedf";
export const size = ogSize;
export const contentType = "image/png";

export default function Image() {
  return renderOg({
    title: "Privacy notice",
    subtitle: "How the workspace and single tools handle your files.",
    footer: "Workspace files deleted after 24 hours · analytics only with consent",
  });
}
