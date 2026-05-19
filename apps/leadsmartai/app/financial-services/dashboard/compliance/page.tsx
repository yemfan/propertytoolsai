import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import ComingSoon from "../_components/ComingSoon";

export const metadata: Metadata = {
  title: "Compliance · LeadSmart AI",
  robots: { index: false },
};

export default function CompliancePage() {
  return (
    <ComingSoon
      icon={ShieldCheck}
      title="Compliance"
      description="Your compliance hub — license status, AML training, supervised-review queue, and audit-ready communications archive."
      availability="Pilot week 1"
      bulletPoints={[
        "State license status + CE credit tracking (NIPR sync in phase 2)",
        "AML & anti-fraud training annual completion log",
        "Supervised-review queue for AI-drafted comms (principal / OSJ approval)",
        "Communications archive — TCPA opt-in proof + 17a-4-aligned retention",
      ]}
    />
  );
}
