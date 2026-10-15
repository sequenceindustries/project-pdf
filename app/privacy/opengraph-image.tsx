import { ogSize, renderOg } from "@/lib/og";

export const alt = "Privacy notice — peedf";
export const size = ogSize;
export const contentType = "image/png";

export default function Image() {
  return renderOg({ title: "Privacy notice", subtitle: "Your files never leave your device. Analytics only with consent." });
}
