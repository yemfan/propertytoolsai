import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mortgage Calculator — Estimate Your Monthly Payment",
  description:
    "Calculate your exact monthly mortgage payment, principal, interest, and total costs with our free mortgage calculator.",
  keywords: [
    "mortgage calculator",
    "monthly payment",
    "mortgage estimate",
    "home loan calculator",
    "principal and interest",
  ],
  openGraph: {
    title: "Mortgage Calculator — Estimate Your Monthly Payment",
    description:
      "Calculate your exact monthly mortgage payment, principal, interest, and total costs with our free mortgage calculator.",
  },
};

export default function MortgageCalculatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
