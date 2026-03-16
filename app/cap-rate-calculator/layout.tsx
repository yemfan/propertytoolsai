import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cap Rate Calculator | PropertyToolsAI",
  description: "Calculate capitalization rate from net operating income and purchase price.",
};

export default function CapRateCalculatorLayout({
  children,
}: { children: React.ReactNode }) {
  return children;
}
