import { ogSize, renderOg } from "@/lib/og";

export const alt = "peedf — PDFs, without the headache";
export const size = ogSize;
export const contentType = "image/png";

export default function Image() {
  return renderOg({
    title: "PDFs, without the headache.",
    subtitle: "Compress, merge, split, convert and protect PDFs in your browser.",
  });
}
