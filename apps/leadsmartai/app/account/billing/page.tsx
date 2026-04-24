import { redirect } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Account Billing",
  description: "Manage your subscription and billing settings.",
  keywords: ["billing", "subscription", "account"],
  robots: { index: false },
};

/** Canonical subscription UI lives at /dashboard/billing. */
export default function AccountBillingPage() {
  redirect("/dashboard/billing");
}
