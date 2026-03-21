import type { Metadata } from "next";
import LeadSmartLanding from "@/components/marketing/LeadSmartLanding";

export const metadata: Metadata = {
  title: "LeadSmart AI — AI CRM & Lead Generation for Real Estate Agents",
  description:
    "Capture seller leads with AI home value funnels, automate follow-up, and run your pipeline in one agent-first CRM. Start free.",
  openGraph: {
    title: "LeadSmart AI — Listings start with better leads",
    description:
      "AI-powered funnels, CRM, and nurture for listing agents. Start free and convert more homeowners into appointments.",
  },
};

export default function HomePage() {
  return <LeadSmartLanding />;
}
