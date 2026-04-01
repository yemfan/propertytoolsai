import PricingHubClientPage from "./page.client";
import { redirectAdminSupportAwayFromCommercialPricing } from "@/lib/auth/redirectStaffFromCommercialPricing";

export const metadata = {
  title: "Choose a plan | LeadSmart AI",
  description:
    "Compare PropertyToolsAI consumer pricing, LeadSmart AI for agents, and loan broker plans.",
};

export default async function PricingHubPage() {
  await redirectAdminSupportAwayFromCommercialPricing();
  return <PricingHubClientPage />;
}
