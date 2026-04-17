import type { Metadata } from "next";
import Link from "next/link";
import { Activity, Inbox } from "lucide-react";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import { countPendingDrafts } from "@/lib/drafts/service";
import DraftsClient from "@/components/dashboard/DraftsClient";
import RunSchedulerButton from "@/components/dashboard/RunSchedulerButton";

export const metadata: Metadata = {
  title: "Drafts · Approval queue",
  description: "Review and approve messages before they send.",
  robots: { index: false },
};

export default async function DraftsPage() {
  const { agentId } = await getCurrentAgentContext();
  const pending = await countPendingDrafts(agentId);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-800 shadow-md shadow-amber-100/40">
            <Inbox className="h-5 w-5" strokeWidth={2} aria-hidden />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              Drafts
              {pending > 0 && (
                <span className="ml-3 rounded-full bg-amber-100 px-2.5 py-0.5 align-middle text-xs font-semibold text-amber-800">
                  {pending} pending
                </span>
              )}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Approval queue for Review-mode messages. Spec §2.4: no draft sends without your approval
              in the first 30 days of your account — and never when you&apos;ve set the policy to
              Review.
            </p>
          </div>
        </div>
        <Link
          href="/dashboard/drafts/activity"
          className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
        >
          <Activity className="h-4 w-4" aria-hidden />
          Activity log
        </Link>
      </div>

      <RunSchedulerButton />

      <DraftsClient />
    </div>
  );
}
