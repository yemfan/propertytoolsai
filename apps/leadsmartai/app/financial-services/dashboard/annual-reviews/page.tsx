import type { Metadata } from "next";
import { RefreshCcw } from "lucide-react";
import ComingSoon from "../_components/ComingSoon";

export const metadata: Metadata = {
  title: "Annual Reviews · LeadSmart AI",
  robots: { index: false },
};

export default function AnnualReviewsPage() {
  return (
    <ComingSoon
      icon={RefreshCcw}
      title="Annual Reviews"
      description="Automated 30-day-before nudges, AI-prepped briefing per client, and review-meeting templates."
      availability="Pilot week 4"
      bulletPoints={[
        "Auto-outreach 30 days before each policy anniversary",
        "AI-generated annual review brief (changes since last year, suggested updates)",
        "Beneficiary verification + rider opportunity flags",
        "Outcome capture (reviewed, updated, additional coverage written)",
      ]}
    />
  );
}
