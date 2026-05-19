import type { Metadata } from "next";
import { Calendar } from "lucide-react";
import ComingSoon from "../_components/ComingSoon";

export const metadata: Metadata = {
  title: "Sit-Downs · LeadSmart AI",
  robots: { index: false },
};

export default function SitDownsPage() {
  return (
    <ComingSoon
      icon={Calendar}
      title="Sit-Downs"
      description="Kitchen-table appointments — booked, confirmed, prepped with an FNA so you walk in ready to present."
      availability="Pilot week 1"
      bulletPoints={[
        "Calendar booking for prospects (Calendly-style, agent-branded)",
        "Auto-reminders T-24h and T-2h via AI SMS",
        "FNA pre-generated 60 min before each sit-down",
        "Post-appointment follow-up template fires same day",
      ]}
    />
  );
}
