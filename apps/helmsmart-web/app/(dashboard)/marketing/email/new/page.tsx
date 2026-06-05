import type { Metadata } from "next";
import { EmailCampaignEditor } from "@/components/email-campaign-editor";

export const metadata: Metadata = { title: "New Email Campaign · Marketing" };

export default function NewEmailCampaignPage() {
  return <EmailCampaignEditor />;
}
