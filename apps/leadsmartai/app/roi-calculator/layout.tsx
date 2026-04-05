import { Metadata } from "next";

export const metadata: Metadata = {
  title: "ROI Calculator",
  description: "Calculate return on investment for rental properties and real estate deals. Analyze cash-on-cash returns, annual ROI, and property appreciation.",
  keywords: ["ROI calculator", "return on investment", "rental property", "cash on cash", "real estate investing"],
};

export default function ROICalculatorLayout({
  children,
}: { children: React.ReactNode }) {
  return children;
}
