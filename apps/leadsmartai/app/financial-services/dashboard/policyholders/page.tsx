import type { Metadata } from "next";
import { Briefcase } from "lucide-react";
import ComingSoon from "../_components/ComingSoon";

export const metadata: Metadata = {
  title: "Policyholders · LeadSmart AI",
  robots: { index: false },
};

export default function PolicyholdersPage() {
  return (
    <ComingSoon
      icon={Briefcase}
      title="Policyholders"
      description="Your book of business — every active policy, carrier, anniversary, and beneficiary in one place."
      availability="Pilot week 4"
      bulletPoints={[
        "Active policies grouped by client (carrier, product, face amount, premium)",
        "Policy-anniversary timeline + auto-nudge for annual reviews",
        "Beneficiary tracking + change request workflow",
        "Carrier-statement reconciliation (CSV import for now, API in phase 2)",
      ]}
    />
  );
}
