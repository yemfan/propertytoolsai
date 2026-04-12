import { redirect } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Loan Broker Pricing",
  description: "View pricing plans for loan brokers.",
  keywords: ["pricing", "loan broker"],
  robots: { index: false },
};

export default function PricingLoanBrokerRedirectPage() {
  redirect("/loan-broker/pricing");
}
