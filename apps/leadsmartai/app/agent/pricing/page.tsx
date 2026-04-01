import AgentPricingClientPage from "./page.client";
import { redirectAdminSupportAwayFromCommercialPricing } from "@/lib/auth/redirectStaffFromCommercialPricing";

export const metadata = {
  title: "Agent plans & billing | LeadSmart AI",
  description: "Compare Starter, Growth, and Elite LeadSmart AI Agent limits and upgrade paths.",
};

export default async function AgentPricingPage() {
  await redirectAdminSupportAwayFromCommercialPricing();
  return <AgentPricingClientPage />;
}
