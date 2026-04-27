import type { Metadata } from "next";
import Link from "next/link";

import SphereMonetizationPanel from "@/components/dashboard/SphereMonetizationPanel";

export const metadata: Metadata = {
  title: "Sphere monetization | LeadSmart AI",
};

/**
 * Combined sphere-monetization surface. The two prediction engines (seller
 * + buyer) score the same cohort with different weights — this page joins
 * their output into a single view so the agent sees BOTH directions per
 * contact and can prioritize highest-leverage outreach overall.
 */
export default function SphereMonetizationPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-6 max-w-2xl">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Sphere monetization
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Past clients and sphere ranked by combined seller + buyer
          likelihood. The biggest opportunities are usually the contacts
          near peak ownership tenure with a job-change or life-event signal
          — they&apos;re about to sell AND buy.
        </p>
        <div className="mt-3 flex flex-wrap gap-3 text-xs">
          <Link
            href="/dashboard/sphere/likely-sellers"
            className="rounded-full border border-slate-200 bg-white px-3 py-1 font-semibold text-slate-700 hover:bg-slate-50"
          >
            Seller view →
          </Link>
          <Link
            href="/dashboard/sphere/likely-buyers"
            className="rounded-full border border-slate-200 bg-white px-3 py-1 font-semibold text-slate-700 hover:bg-slate-50"
          >
            Buyer view →
          </Link>
        </div>
      </header>

      <SphereMonetizationPanel defaultLimitPerSide={100} />
    </main>
  );
}
