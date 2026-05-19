import type { Metadata } from "next";
import FinancialServicesPricingClient from "./page.client";

export const metadata: Metadata = {
  title: "Pricing · LeadSmart AI for Financial Services",
  description:
    "Per-producer pricing for IMOs and MLM financial services agencies. Pilot pricing available for first cohorts.",
};

export default function FinancialServicesPricingPage() {
  return <FinancialServicesPricingClient />;
}
