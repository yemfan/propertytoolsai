import { FounderDashboardClient } from "./FounderDashboardClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Founder Analytics",
  description: "MRR, funnel, churn, and usage event analytics.",
  keywords: ["founder", "analytics", "MRR"],
  robots: { index: false },
};

export default function FounderAnalyticsPage() {
  return <FounderDashboardClient />;
}
