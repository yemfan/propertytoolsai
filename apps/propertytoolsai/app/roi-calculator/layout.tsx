import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ROI & Cash Flow Calculator — Analyze Investment Returns",
  description:
    "Calculate long-term ROI and cash flow for rental properties including rent, expenses, and appreciation projections.",
  keywords: [
    "ROI calculator",
    "cash flow calculator",
    "rental property analysis",
    "investment return",
    "property ROI",
  ],
};

export default function ROICalculatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
