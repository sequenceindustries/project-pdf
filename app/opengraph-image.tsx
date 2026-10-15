import { ogSize, renderOg } from "@/lib/og";

export const alt = "peedf — PDFs, without the headache";
export const size = ogSize;
export const contentType = "image/png";

export default function Image() {
  return renderOg({
    title: "Your PDFs. Your instructions.",
    subtitle: "Upload a PDF, say what you need, download the result.",
    footer: "Files deleted after 24 hours · single tools stay on your device",
  });
}
