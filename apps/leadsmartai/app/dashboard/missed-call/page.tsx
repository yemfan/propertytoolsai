import type { Metadata } from "next";
import Link from "next/link";
import MissedCallSettingsPanel from "@/components/dashboard/MissedCallSettingsPanel";

export const metadata: Metadata = {
  title: "Missed-call text-back",
  description:
    "Auto-text inbound callers when you don't pick up. Configure your forwarding number, ring timeout, AI personalization, and message template — and review the activity log for every recent call.",
  robots: { index: false },
};

/**
 * Dedicated /dashboard/missed-call page.
 *
 * The same `MissedCallSettingsPanel` is also mounted inside the Voice
 * tab on /dashboard/settings — that's the right home for agents who
 * are already deep in their account config. This dedicated page is
 * the sidebar entry point: agents who want to jump straight to "is
 * my missed-call text-back working?" get a focused surface that
 * doesn't bury the activity log under unrelated voice + AI settings.
 */
export default function MissedCallPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <div className="text-xs text-slate-500">
          <Link href="/dashboard/overview" className="hover:underline">
            Dashboard
          </Link>
          {" / Missed-call text-back"}
        </div>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">
          Missed-call text-back
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Forward calls to your personal mobile and auto-text inbound callers
          when you don&apos;t pick up — so leads don&apos;t drop off your
          funnel just because you were on another call.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <MissedCallSettingsPanel />
      </div>

      <p className="text-xs text-slate-500">
        Looking for the rest of your voice and AI settings?{" "}
        <Link href="/dashboard/settings" className="text-blue-700 hover:underline">
          Open Settings
        </Link>
        .
      </p>
    </div>
  );
}
