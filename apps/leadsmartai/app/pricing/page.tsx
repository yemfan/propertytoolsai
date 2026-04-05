import ConsumerPricingClientPage from "./page.client";
import { redirectAdminSupportAwayFromCommercialPricing } from "@/lib/auth/redirectStaffFromCommercialPricing";

export const metadata = {
  title: "Pricing | LeadSmart AI",
  description:
    "Free, Pro ($49), Elite ($99), and Team ($199) plans — full feature comparison for AI lead management, CRM, and automation.",
};

export default async function ConsumerPricingPage() {
  await redirectAdminSupportAwayFromCommercialPricing();
  return <ConsumerPricingClientPage />;
}
