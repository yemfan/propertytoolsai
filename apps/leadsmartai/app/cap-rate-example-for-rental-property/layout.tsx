import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cap Rate Example for Rental Property",
  description: "Learn cap rate with real examples. See how to calculate capitalization rate for actual rental properties and deals.",
  keywords: ["cap rate example", "rental property", "calculation example", "real estate", "investment analysis"],
};

export default function CapRateExampleLayout({
  children,
}: { children: React.ReactNode }) {
  return children;
}
