import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "CMA Report — Comparative Market Analysis",
  description:
    "Generate a comparative market analysis with estimated value, price range, and listing strategies based on recent sales.",
  keywords: [
    "CMA report",
    "comparative market analysis",
    "home valuation",
    "listing price",
    "market analysis",
    "comps analysis",
  ],
};

export default function SmartCmaBuilderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
