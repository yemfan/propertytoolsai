import type { Metadata } from "next";
import Link from "next/link";
import { Activity } from "lucide-react";
import SchedulerActivityClient from "@/components/dashboard/SchedulerActivityClient";

export const metadata: Metadata = {
  title: "Scheduler activity",
  description:
    "Audit log of trigger firings: created, suppressed, already-fired. Debug why a specific trigger did or didn't fire.",
  robots: { index: false },
};

export default function SchedulerActivityPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-md shadow-slate-900/15">
            <Activity className="h-5 w-5" strokeWidth={2} aria-hidden />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              Scheduler activity
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Every trigger the scheduler evaluates lands here — whether it created a draft or
              suppressed one. Use this to debug why a specific template didn&apos;t fire for a
              specific contact.
            </p>
          </div>
        </div>
        <Link
          href="/dashboard/drafts"
          className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
        >
          ← Back to drafts
        </Link>
      </div>

      <SchedulerActivityClient />
    </div>
  );
}
