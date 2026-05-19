import type { Metadata } from "next";
import { Plug } from "lucide-react";
import ComingSoon from "../_components/ComingSoon";

export const metadata: Metadata = {
  title: "Integrations · LeadSmart AI",
  robots: { index: false },
};

export default function IntegrationsPage() {
  return (
    <ComingSoon
      icon={Plug}
      title="Integrations"
      description="Connect your existing carrier portals, illustrators, e-app providers, and calendar so LeadSmart AI fits into the workflow you already have."
      availability="Pilot week 3"
      bulletPoints={[
        "Carrier illustration tools (WinFlex, iPipeline) — pending API access",
        "E-application (DocuSign / iGo / FireLight)",
        "Google Calendar + Outlook for sit-down booking",
        "Twilio voice + SMS (already configured for this workspace)",
      ]}
    />
  );
}
