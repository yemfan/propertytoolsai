import { Suspense } from "react";
import BillingPageClient from "./BillingPageClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Billing",
  description: "Manage your subscription and payment details.",
  keywords: ["billing", "subscription", "payments"],
  robots: { index: false },
};

export default function DashboardBillingPage() {
  return (
    <Suspense fallback={<div className="text-sm text-gray-600 p-4">Loading billing…</div>}>
      <BillingPageClient />
    </Suspense>
  );
}
