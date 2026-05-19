import { Suspense } from "react";
import type { Metadata } from "next";
import CompetitorComparisonClient from "./CompetitorComparisonClient";

export const metadata: Metadata = {
  title: "Competitor Comparison · LeadSmart AI for Financial Services",
  description:
    "Honest side-by-side of LeadSmart AI vs. carrier portals, AgencyBloc/Redtail, Salesforce FSC, and spreadsheets+WhatsApp for MLM financial services agencies.",
  robots: { index: false },
};

export default function CompetitorComparisonPage() {
  return (
    <Suspense fallback={<div />}>
      <CompetitorComparisonClient />
    </Suspense>
  );
}
