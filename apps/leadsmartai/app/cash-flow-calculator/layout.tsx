import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cash Flow Calculator | LeadSmart AI",
  description: "Estimate monthly and annual cash flow from rental property.",
};

export default function CashFlowCalculatorLayout({
  children,
}: { children: React.ReactNode }) {
  return children;
}
