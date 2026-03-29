import { Metadata } from "next";

export const metadata: Metadata = {
  title: "ROI Calculator | LeadSmart AI",
  description: "Estimate return on investment for rental property including rent, expenses, and appreciation.",
};

export default function ROICalculatorLayout({
  children,
}: { children: React.ReactNode }) {
  return children;
}
