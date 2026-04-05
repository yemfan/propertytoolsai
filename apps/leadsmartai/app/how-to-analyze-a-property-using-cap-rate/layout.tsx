import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "How to Analyze a Property Using Cap Rate",
  description: "Learn how to use cap rate to analyze rental properties. Step-by-step guide for real estate investors and agents.",
  keywords: ["cap rate analysis", "property analysis", "rental property", "investment guide", "real estate"],
};

export default function CapRateAnalysisLayout({
  children,
}: { children: React.ReactNode }) {
  return children;
}
