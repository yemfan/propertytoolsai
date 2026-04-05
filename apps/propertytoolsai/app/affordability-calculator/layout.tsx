import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Affordability Calculator — How Much Home Can You Afford?",
  description:
    "Determine how much house you can afford based on income and debts using our debt-to-income ratio calculator.",
  keywords: [
    "affordability calculator",
    "home affordability",
    "how much home can I afford",
    "debt-to-income ratio",
    "home price calculator",
  ],
  openGraph: {
    title: "Affordability Calculator — How Much Home Can You Afford?",
    description:
      "Determine how much house you can afford based on income and debts using our debt-to-income ratio calculator.",
  },
};

export default function AffordabilityCalculatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
