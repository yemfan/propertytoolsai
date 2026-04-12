import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "How to Analyze a Property Using Cap Rate",
  description: "Use cap rate analysis to quickly evaluate whether a rental property is a good investment.",
  keywords: ["analyze property", "cap rate analysis", "investment evaluation", "rental property"],
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
