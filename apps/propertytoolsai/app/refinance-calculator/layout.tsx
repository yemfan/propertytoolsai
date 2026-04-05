import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Refinance Calculator — Should You Refinance?",
  description:
    "Compare your current mortgage to a new rate and estimate monthly savings and break-even with our refinance calculator.",
  keywords: [
    "refinance calculator",
    "mortgage refinance",
    "refinance savings",
    "break even refinance",
    "rate comparison",
  ],
  openGraph: {
    title: "Refinance Calculator — Should You Refinance?",
    description:
      "Compare your current mortgage to a new rate and estimate monthly savings and break-even with our refinance calculator.",
  },
};

export default function RefinanceCalculatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
