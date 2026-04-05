import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Adjustable Rate Mortgage Calculator",
  description: "Calculate ARM payments and rate adjustments over time. Compare initial rates, caps, and long-term costs for adjustable mortgages.",
  keywords: ["ARM calculator", "adjustable rate mortgage", "rate adjustment", "mortgage payment", "real estate"],
};

export default function AdjustableRateCalculatorLayout({
  children,
}: { children: React.ReactNode }) {
  return children;
}
