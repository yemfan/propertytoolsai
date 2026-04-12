import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Property Details",
  description: "View detailed property information and market analysis.",
  keywords: ["property", "real estate", "listing"],
  robots: { index: false },
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
