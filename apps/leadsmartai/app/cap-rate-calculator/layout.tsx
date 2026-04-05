import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cap Rate Calculator",
  description: "Calculate capitalization rate and NOI for rental properties. Analyze investment returns and compare deals with our property cap rate calculator.",
  keywords: ["cap rate calculator", "NOI", "capitalization rate", "rental property", "real estate investing"],
};

export default function CapRateCalculatorLayout({
  children,
}: { children: React.ReactNode }) {
  return children;
}
