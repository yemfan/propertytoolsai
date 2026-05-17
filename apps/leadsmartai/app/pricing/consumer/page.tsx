import { permanentRedirect } from "next/navigation";
import type { Metadata } from "next";

/**
 * Permanent (308) redirect to the canonical consumer pricing surface
 * at /pricing. Kept for SEO-equity preservation on inbound links.
 */
export const metadata: Metadata = {
  title: "Consumer Pricing",
  description: "View pricing for home buyers and sellers.",
  keywords: ["pricing", "consumer"],
  robots: { index: false },
  alternates: { canonical: "/pricing" },
};

export default function PricingConsumerRedirectPage() {
  permanentRedirect("/pricing");
}
