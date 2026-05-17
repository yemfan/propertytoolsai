import { permanentRedirect } from "next/navigation";
import type { Metadata } from "next";

/**
 * Permanent (308) redirect to the canonical loan-broker pricing
 * surface at /loan-broker/pricing. Kept for SEO-equity preservation.
 */
export const metadata: Metadata = {
  title: "Loan Broker Pricing",
  description: "View pricing plans for loan brokers.",
  keywords: ["pricing", "loan broker"],
  robots: { index: false },
  alternates: { canonical: "/loan-broker/pricing" },
};

export default function PricingLoanBrokerRedirectPage() {
  permanentRedirect("/loan-broker/pricing");
}
