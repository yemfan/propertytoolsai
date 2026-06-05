import type { Metadata } from "next";
import { SMSCampaignEditor } from "@/components/sms-campaign-editor";

export const metadata: Metadata = { title: "New SMS Campaign · Marketing" };

export default function NewSMSCampaignPage() {
  return <SMSCampaignEditor />;
}
