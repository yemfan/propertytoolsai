import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cash Flow Calculator",
  description: "Calculate monthly and annual cash flow for rental properties. Analyze income, expenses, and profitability with our property cash flow calculator.",
  keywords: ["cash flow calculator", "rental property", "monthly income", "expenses", "real estate investing"],
};

export default function CashFlowCalculatorLayout({
  children,
}: { children: React.ReactNode }) {
  return children;
}
