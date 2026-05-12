import type { Metadata } from "next";
import Link from "next/link";

import { getCurrentAgentContext } from "@/lib/dashboardService";

export const metadata: Metadata = {
  title: "Generate Leads | LeadSmart AI",
  description:
    "Generate social posts and run ads to bring new leads into LeadSmart AI.",
  robots: { index: false },
};

/**
 * Landing for the Generate Leads feature. Two big cards:
 *   - Quick Post: AI-drafted social post → one-click share (Phase 1A)
 *   - Run Ads: campaign wizard for Meta + Google ads (Phase 2)
 *
 * Phase 1A ships only Quick Post; the Run Ads card renders disabled
 * with a "Coming soon" affordance so agents see the roadmap without
 * a dead button. When Phase 2 ships we just flip the disabled flag.
 */
export default async function GenerateLeadsPage() {
  // Ensure the user is signed in / has an agent row — same auth shape
  // as the rest of the dashboard. The card-level gating (Pro vs free)
  // happens in the API route, but we surface a friendly heads-up here
  // when applicable.
  await getCurrentAgentContext();

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Generate Leads</h1>
          <p className="text-sm text-gray-500">
            Draft social posts in seconds, then share to Facebook, Instagram,
            LinkedIn, or X.
          </p>
        </div>
        <Link
          href="/dashboard/leads/generate/connect"
          className="shrink-0 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Connect platforms →
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/dashboard/leads/generate/post/new"
          className="group block rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-blue-300 hover:shadow-md"
        >
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.75}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4.5v15m7.5-7.5h-15"
              />
            </svg>
          </div>
          <h2 className="text-base font-semibold text-gray-900">Quick Post</h2>
          <p className="mt-1 text-sm text-gray-600">
            Tap to draft a social post about a listing or open house. AI writes
            it, you share it — Facebook, Instagram, LinkedIn, X.
          </p>
          <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-blue-600 group-hover:gap-1.5">
            New post
            <svg
              className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13.5 4.5l7.5 7.5-7.5 7.5M3 12h18"
              />
            </svg>
          </span>
        </Link>

        <div
          aria-disabled
          className="block cursor-not-allowed rounded-2xl border border-dashed border-gray-300 bg-gray-50/60 p-5 shadow-sm opacity-80"
        >
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-gray-500">
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.75}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 5l7 7-7 7"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5.25 9.75a2.25 2.25 0 014.5 0v4.5a2.25 2.25 0 01-4.5 0v-4.5z"
              />
            </svg>
          </div>
          <div className="mb-1 flex items-center gap-2">
            <h2 className="text-base font-semibold text-gray-900">Run Ads</h2>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
              Coming soon
            </span>
          </div>
          <p className="text-sm text-gray-600">
            Boost a listing or run a lead-gen campaign on Facebook / Instagram
            via Meta, and Google Search ads. Leads land directly in your CRM.
          </p>
          <p className="mt-4 text-xs text-gray-500">
            Premium only · Meta + Google ad billing stays with you
          </p>
        </div>
      </div>

      <p className="mt-6 text-xs text-gray-400">
        Phase 1: Quick Post (today). Phase 2 (in ~4 weeks): direct Meta posting
        + Meta Lead Ads. Phase 3: Google Ads + cross-platform optimizer.
      </p>
    </div>
  );
}
