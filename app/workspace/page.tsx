import type { Metadata } from "next";
import Workspace from "./workspace";

export const metadata: Metadata = {
  title: "AI workspace",
  description: "Upload a PDF, tell peedf what you need, and get it done.",
};

export default function Page() {
  return <Workspace />;
}
