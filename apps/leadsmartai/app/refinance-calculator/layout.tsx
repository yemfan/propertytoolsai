import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Refinance Calculator",
  description: "Calculate refinance savings and break-even point. Compare current mortgage with new loan options to determine if refinancing saves money.",
  keywords: ["refinance calculator", "mortgage refinance", "savings", "lower rate", "real estate"],
};

export default function RefinanceCalculatorLayout({
  children,
}: { children: React.ReactNode }) {
  return children;
}
