import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Property Investment Analyzer | PropertyToolsAI",
  description: "Analyze NOI, cash flow, cap rate, and ROI for rental property investments.",
};

export default function PropertyInvestmentAnalyzerLayout({
  children,
}: { children: React.ReactNode }) {
  return children;
}
