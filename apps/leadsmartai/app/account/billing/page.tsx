import { redirect } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Account Billing",
  description: "Manage your subscription and billing settings.",
  keywords: ["billing", "subscription", "account"],
  robots: { index: false },
};

/**
 * Canonical subscription UI lives at /dashboard/billing. The account
 * layout isn't subscription-gated, so this entry-point is reachable
 * even when a user's subscription is inactive — we just redirect
 * them to the dashboard billing page, which is now explicitly
 * carved out of the dashboard layout's subscription gate.
 */
export default function AccountBillingPage() {
  redirect("/dashboard/billing");
}
