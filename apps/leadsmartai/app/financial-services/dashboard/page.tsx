import { redirect } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Financial Services Dashboard",
  description: "Pipeline, recruits, and AI tools for financial services producers.",
  keywords: ["financial advisor", "IUL", "annuity", "term life", "MLM", "recruiting"],
  robots: { index: false },
};

export default function FinancialServicesDashboardIndex() {
  redirect("/financial-services/dashboard/overview");
}
