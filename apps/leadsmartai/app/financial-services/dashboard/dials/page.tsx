import type { Metadata } from "next";
import { Phone } from "lucide-react";
import ComingSoon from "../_components/ComingSoon";

export const metadata: Metadata = {
  title: "Dials · LeadSmart AI",
  robots: { index: false },
};

export default function DialsPage() {
  return (
    <ComingSoon
      icon={Phone}
      title="Dials"
      description="Outbound call queue with AI prep notes, click-to-dial, and post-call disposition logging."
      availability="Pilot week 3"
      bulletPoints={[
        "Daily dial list sorted by intent score + last-touch recency",
        "Pre-call AI brief (prospect facts, last interaction, recommended angle)",
        "Click-to-dial via your phone or Twilio voice",
        "Post-call disposition + auto-scheduled follow-up",
      ]}
    />
  );
}
