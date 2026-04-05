import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Home Value Estimator",
  description: "Estimate your home value using comparable sales, property details, and market data. Quick home valuation calculator for real estate agents.",
  keywords: ["home value", "home appraisal", "property value", "comparable sales", "real estate valuation"],
};

export default function HomeValueEstimatorLayout({
  children,
}: { children: React.ReactNode }) {
  return children;
}
