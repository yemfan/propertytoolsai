import Link from "next/link";
import { Suspense } from "react";
import { BillingSuccessClient } from "./BillingSuccessClient";

export default function BillingSuccessPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <Suspense fallback={null}>
        <BillingSuccessClient />
      </Suspense>
      <div className="w-full max-w-lg rounded-3xl border bg-white p-10 text-center shadow-sm">
        <h1 className="text-3xl font-semibold tracking-tight text-gray-900">
          Payment Successful
        </h1>
        <p className="mt-3 text-gray-500">
          Your subscription has been updated successfully.
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/account/billing"
            className="rounded-2xl bg-gray-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-gray-800"
          >
            View Billing
          </Link>
          <Link
            href="/dashboard-router"
            className="rounded-2xl border border-gray-200 px-5 py-3 text-sm font-medium text-gray-900 transition hover:bg-gray-50"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
