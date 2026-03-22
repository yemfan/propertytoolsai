import type { Metadata } from "next";
import OnboardingFunnel from "@/components/onboarding/OnboardingFunnel";

export const metadata: Metadata = {
  title: "Get started — LeadSmart AI",
  description:
    "Interactive onboarding: personalize your market, preview AI leads, then unlock full CRM and automation.",
  robots: { index: false, follow: true },
};

export default function OnboardingPage() {
  return <OnboardingFunnel />;
}
