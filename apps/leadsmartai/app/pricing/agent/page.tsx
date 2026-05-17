import { permanentRedirect } from "next/navigation";
import type { Metadata } from "next";

/**
 * Permanent (308) redirect to the canonical agent pricing surface
 * at /agent/pricing. Kept for SEO-equity preservation on inbound
 * links — search engines and clients honor 308 by updating the
 * stored URL, which `redirect()` (307 Temporary) does not.
 */
export const metadata: Metadata = {
  title: "Agent Pricing",
  description: "View pricing plans for real estate agents.",
  keywords: ["pricing", "agent plans"],
  robots: { index: false },
  alternates: { canonical: "/agent/pricing" },
};

export default function PricingAgentRedirectPage() {
  permanentRedirect("/agent/pricing");
}
