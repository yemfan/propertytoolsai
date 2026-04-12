import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Opportunities",
  description: "Track deal opportunities and conversion pipeline.",
  keywords: ["opportunities", "deals", "pipeline"],
  robots: { index: false },
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
