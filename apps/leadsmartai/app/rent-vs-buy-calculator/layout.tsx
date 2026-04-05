import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Rent vs Buy Calculator",
  description: "Compare renting vs buying costs over time. Analyze total expenses, equity, and returns to determine the better option for your situation.",
  keywords: ["rent vs buy", "rent calculator", "buy calculator", "home ownership", "real estate"],
};

export default function RentVsBuyCalculatorLayout({
  children,
}: { children: React.ReactNode }) {
  return children;
}
