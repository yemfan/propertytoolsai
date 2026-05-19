import type { Metadata } from "next";
import { UserCircle2 } from "lucide-react";
import ComingSoon from "../_components/ComingSoon";

export const metadata: Metadata = {
  title: "Profile · LeadSmart AI",
  robots: { index: false },
};

export default function ProfilePage() {
  return (
    <ComingSoon
      icon={UserCircle2}
      title="Profile"
      description="Your producer profile, agent branding, agency hierarchy, carrier appointments, and notification preferences."
      availability="Pilot week 2"
      bulletPoints={[
        "Public profile + agent branding (logo, photo, calendar link)",
        "Hierarchy info (your sponsor, your downline tier)",
        "Carrier appointments tracked per state",
        "Notification preferences (SMS, email, push)",
      ]}
    />
  );
}
