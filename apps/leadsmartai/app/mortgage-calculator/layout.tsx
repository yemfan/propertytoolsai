import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mortgage Calculator",
  description: "Calculate monthly mortgage payments and amortization. Estimate loan costs with taxes, insurance, and HOA fees included.",
  keywords: ["mortgage calculator", "monthly payment", "loan calculator", "interest rate", "real estate"],
};

export default function MortgageCalculatorLayout({
  children,
}: { children: React.ReactNode }) {
  return children;
}
