import type { Metadata } from "next";
import { Coins } from "lucide-react";
import ComingSoon from "../_components/ComingSoon";

export const metadata: Metadata = {
  title: "Overrides · LeadSmart AI",
  robots: { index: false },
};

export default function OverridesPage() {
  return (
    <ComingSoon
      icon={Coins}
      title="Overrides"
      description="Hierarchical override commissions — earned, advanced, charged back, and projected from your downline's production."
      availability="Phase 2 (post-pilot)"
      bulletPoints={[
        "Carrier-statement CSV ingestion (Transamerica, Nationwide, Foresters)",
        "Override allocation by hierarchy tier + agreement",
        "Advance vs. earned breakdown with chargeback exposure",
        "Projected month-end override based on submitted-not-issued business",
      ]}
    />
  );
}
