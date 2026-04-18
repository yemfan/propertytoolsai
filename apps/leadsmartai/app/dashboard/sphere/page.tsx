import type { Metadata } from "next";
import Link from "next/link";
import { Upload, Users } from "lucide-react";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import { listContacts } from "@/lib/contacts/service";
import type { ContactView } from "@/lib/contacts/types";
import SphereDashboardClient from "@/components/dashboard/SphereDashboardClient";

export const metadata: Metadata = {
  title: "Sphere",
  description: "Past clients and sphere — who to touch today, ranked by reason.",
  robots: { index: false },
};

export default async function SpherePage() {
  // listContacts already swallows missing-relation errors (42P01/42703)
  // from the schema migration's deploy window. Wrap once more at the page
  // level so an unexpected auth failure or network hiccup during SSR
  // still renders the empty state instead of the dashboard error boundary.
  let contacts: ContactView[] = [];
  try {
    const { agentId } = await getCurrentAgentContext();
    contacts = await listContacts(agentId, {
      lifecycle_stage: ["past_client", "sphere", "referral_source"],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const code = (err as { code?: string } | null)?.code;
    console.error("[sphere] load failed", { code, msg });
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-md shadow-slate-900/15">
            <Users className="h-5 w-5" strokeWidth={2} aria-hidden />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Sphere</h1>
            <p className="mt-1 text-sm text-slate-600">
              Past clients and sphere contacts, ranked by reason to reach out today. Equity deltas come
              from the most recent AVM refresh.
            </p>
          </div>
        </div>
        <Link
          href="/dashboard/sphere/import"
          className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
        >
          <Upload className="h-4 w-4" aria-hidden />
          Import CSV
        </Link>
      </div>

      <SphereDashboardClient contacts={contacts} />
    </div>
  );
}
