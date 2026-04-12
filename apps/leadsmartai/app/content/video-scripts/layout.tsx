import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Video Scripts",
  description: "AI-generated video scripts for real estate marketing.",
  keywords: ["video scripts", "marketing", "content"],
  robots: { index: false },
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
