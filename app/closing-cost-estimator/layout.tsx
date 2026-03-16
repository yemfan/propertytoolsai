import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Closing Cost Estimator | PropertyToolsAI",
  description: "Estimate closing costs for your home purchase. Loan origination, title, appraisal, and more.",
};

export default function ClosingCostEstimatorLayout({
  children,
}: { children: React.ReactNode }) {
  return children;
}
