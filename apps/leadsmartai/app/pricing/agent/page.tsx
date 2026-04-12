import { redirect } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Agent Pricing",
  description: "View pricing plans for real estate agents.",
  keywords: ["pricing", "agent plans"],
  robots: { index: false },
};

export default function PricingAgentRedirectPage() {
  redirect("/agent/pricing");
}
