import ConsumerPricingClientPage from "./page.client";
import { redirectAdminSupportAwayFromCommercialPricing } from "@/lib/auth/redirectStaffFromCommercialPricing";

export const metadata = {
  title: "Pricing | LeadSmart AI",
  description:
    "Plans for AI CMAs, lead management, CRM, and alerts — from free trial to team scale.",
};

export default async function ConsumerPricingPage() {
  await redirectAdminSupportAwayFromCommercialPricing();
  return <ConsumerPricingClientPage />;
}
