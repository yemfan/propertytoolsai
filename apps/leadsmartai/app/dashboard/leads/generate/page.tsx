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
