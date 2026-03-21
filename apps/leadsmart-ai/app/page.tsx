import type { Metadata } from "next";
import LeadSmartLanding from "@/components/marketing/LeadSmartLanding";

export const metadata: Metadata = {
  title: "LeadSmart AI — AI Growth Engine for Agents & Mortgage Pros",
  description:
    "Turn online traffic into closed deals. AI capture, lead scoring, and automated follow-up for real estate agents and loan brokers. Start free.",
  openGraph: {
    title: "LeadSmart AI — Turn traffic into pipeline",
    description:
      "Capture high-intent leads from home value & mortgage tools, automate nurture, and close more deals. Built for agents and brokers.",
  },
};

export default function HomePage() {
  return <LeadSmartLanding />;
}
