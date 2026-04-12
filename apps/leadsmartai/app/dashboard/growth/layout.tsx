import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Growth & SEO",
  description: "Track traffic, manage landing pages, and grow your online presence.",
  keywords: ["growth", "SEO", "traffic", "landing pages"],
  robots: { index: false },
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
