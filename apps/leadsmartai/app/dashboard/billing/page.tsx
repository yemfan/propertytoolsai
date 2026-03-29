import { Suspense } from "react";
import BillingPageClient from "./BillingPageClient";

export default function DashboardBillingPage() {
  return (
    <Suspense fallback={<div className="text-sm text-gray-600 p-4">Loading billing…</div>}>
      <BillingPageClient />
    </Suspense>
  );
}
