import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Rent vs Buy Calculator — Compare the True Costs",
  description:
    "Compare the total cost of renting versus buying a home over your time horizon with our rent vs buy calculator.",
  keywords: [
    "rent vs buy calculator",
    "rent vs buy comparison",
    "should I rent or buy",
    "home ownership costs",
    "rental cost analysis",
  ],
};

export default function RentVsBuyCalculatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
