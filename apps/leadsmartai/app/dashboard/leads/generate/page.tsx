import type { Metadata } from "next";
import Link from "next/link";

import { getCurrentAgentContext } from "@/lib/dashboardService";
import { getWeeklySuggestions, type Suggestion } from "@/lib/leads-gen/suggestions";

export const metadata: Metadata = {
  title: "Generate Leads | LeadSmart AI",
  description:
    "Generate social posts and run ads to bring new leads into LeadSmart AI.",
  robots: { index: false },
};

/**
 * Landing for the Generate Leads feature. Three sections stacked:
 *
 *   1. Two big cards (Quick Post / Run Ads — the latter Coming Soon)
 *   2. "Suggested this week" — up to 3 deep-link cards built from
 *      the agent's CRM (newest listing, upcoming open house, recent
 *      close). Each card pre-fills the wizard via query params.
 *   3. Phase roadmap footer.
 *
 * Plan-gating happens server-side in the API routes; this page is
 * accessible to any signed-in agent because we want free-plan users
 * to see what they'd get if they upgraded.
 */
export default async function GenerateLeadsPage() {
  const { agentId } = await getCurrentAgentContext();

  // Suggestions are best-effort — a query failure shouldn't blank
  // the whole page. Empty array == no suggestion strip rendered.
  let suggestions: Suggestion[] = [];
  try {
    suggestions = await getWeeklySuggestions(String(agentId));
  } catch (e) {
    console.warn("[leads/generate] getWeeklySuggestions failed:", e);
  }

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
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/dashboard/leads/generate/scheduled"
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Scheduled →
          </Link>
          <Link
            href="/dashboard/leads/generate/connect"
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Connect platforms →
          </Link>
        </div>
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
          href="/dashboard/leads/generate/ads"
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
                d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312"
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
            Launch a Meta Lead Ad campaign — your leads land directly in the
            CRM tagged with the source campaign.
          </p>
          <p className="mt-3 text-xs text-gray-500">
            Meta ad billing stays with you · Google Ads in Phase 3
          </p>
          <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-purple-600 group-hover:gap-1.5">
            View campaigns
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

      {suggestions.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-gray-900">
            Suggested this week
          </h2>
          <p className="mb-3 text-xs text-gray-500">
            Click a card to open the wizard pre-filled with this subject.
          </p>
          <div className="space-y-2">
            {suggestions.map((s) => (
              <Link
                key={s.key}
                href={`/dashboard/leads/generate/post/new?trigger=${s.trigger}&subjectId=${encodeURIComponent(s.subjectId)}`}
                className="group flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm transition hover:border-blue-300 hover:shadow-md"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <SuggestionBadge badge={s.badge} />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-gray-900">
                      {s.title}
                    </div>
                    {s.subtitle && (
                      <div className="truncate text-xs text-gray-500">
                        {s.subtitle}
                      </div>
                    )}
                  </div>
                </div>
                <span className="shrink-0 text-sm font-medium text-blue-600 group-hover:translate-x-0.5">
                  Draft post →
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <p className="mt-6 text-xs text-gray-400">
        Phase 1: Quick Post (today). Phase 2 (in ~4 weeks): direct Meta posting
        + Meta Lead Ads. Phase 3: Google Ads + cross-platform optimizer.
      </p>
    </div>
  );
}

function SuggestionBadge({ badge }: { badge: Suggestion["badge"] }) {
  const map: Record<
    Suggestion["badge"],
    { label: string; bg: string; fg: string }
  > = {
    new: { label: "New", bg: "bg-blue-100", fg: "text-blue-700" },
    this_week: { label: "This week", bg: "bg-emerald-100", fg: "text-emerald-700" },
    celebrate: { label: "Just closed", bg: "bg-amber-100", fg: "text-amber-800" },
  };
  const { label, bg, fg } = map[badge];
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${bg} ${fg}`}
    >
      {label}
    </span>
  );
}
