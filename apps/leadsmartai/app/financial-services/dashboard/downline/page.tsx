import type { Metadata } from "next";
import { Users } from "lucide-react";
import ComingSoon from "../_components/ComingSoon";

export const metadata: Metadata = {
  title: "Downline · LeadSmart AI",
  robots: { index: false },
};

export default function DownlinePage() {
  return (
    <ComingSoon
      icon={Users}
      title="Downline"
      description="Your full hierarchy — every associate under you, their pipeline, their production, their licensing status."
      availability="Pilot week 2"
      bulletPoints={[
        "Tree view of your downline (frontline + deep)",
        "Per-associate KPI roll-up (prospects, FNAs, sit-downs, sales)",
        "Licensing & carrier-appointment status at a glance",
        "Drill-into any associate's workspace as a view-only upline",
      ]}
    />
  );
}
