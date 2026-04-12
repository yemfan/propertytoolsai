import { redirect } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Account Billing",
  description: "Manage your subscription and billing settings.",
  keywords: ["billing", "subscription", "account"],
  robots: { index: false },
};

/** Canonical subscription UI today — replace with a dedicated billing portal when added. */
export default function AccountBillingPage() {
  redirect("/dashboard/settings");
}
