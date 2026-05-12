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

        <Link
          href="/dashboard/leads/generate/ads/new"
          className="group block rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-purple-300 hover:shadow-md"
        >
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
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
                d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z"
              />
            </svg>
          </div>
          <div className="mb-1 flex items-center gap-2">
            <h2 className="text-base font-semibold text-gray-900">Run Ads</h2>
            <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-purple-800">
              Premium
            </span>
          </div>
          <p className="text-sm text-gray-600">
            Launch a Meta Lead Ad campaign. Leads land directly in your CRM
            tagged with the source campaign.
          </p>
          <p className="mt-3 text-xs text-gray-500">
            Meta ad billing stays with you · Google Ads in Phase 3
          </p>
          <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-purple-600 group-hover:gap-1.5">
            New campaign
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
      </div>

      <p className="mt-6 text-xs text-gray-400">
        Phase 1: Quick Post (today). Phase 2 (in ~4 weeks): direct Meta posting
        + Meta Lead Ads. Phase 3: Google Ads + cross-platform optimizer.
      </p>
    </div>
  );
}
