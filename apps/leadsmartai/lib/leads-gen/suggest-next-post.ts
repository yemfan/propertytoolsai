import "server-only";

import { getSubjectsForTrigger, type Subject } from "./subjects";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Suggest-next-post helper.
 *
 * Cross-references the agent's CRM subjects (new listings, upcoming
 * open houses, just-solds) against their recent published posts to
 * find what they haven't promoted yet. Pure deterministic — no
 * Claude call. Faster, free, debuggable.
 *
 * Powers the mobile Home "Suggested next post" card. Tap a
 * suggestion → opens Quick Post with the right trigger + subject
 * already selected, brief pre-filled.
 *
 * Ranking heuristics (urgency × recency):
 *   - Open house in next 48h         → urgency 100
 *   - Open house in next 7 days      → urgency 80
 *   - New listing in last 7 days     → urgency 70
 *   - Just-sold in last 14 days      → urgency 60
 *   - New listing in 7-30 days range → urgency 40
 *
 * Subjects already promoted in the last 30 days are filtered out
 * entirely — no point suggesting "post about your new listing
 * 123 Main St" if they already did exactly that.
 */

export type NextPostSuggestion = {
  /** Trigger to pre-select in Quick Post. */
  trigger: "new_listing" | "open_house" | "just_sold";
  /** Subject id matching the wire format (e.g. `listing:<uuid>`). */
  subjectId: string;
  /** Human-readable label — first line of the card. */
  label: string;
  /** Sub-label — address, date, etc. */
  sub: string | null;
  /** One-line "why this suggestion" hint shown below the label. */
  reason: string;
  /** Internal score used to rank — exposed for debugging only. */
  urgency: number;
};

type RecentPostKey = string; // `${subjectKind}:${subjectRefId}`

const LOOKBACK_DAYS = 30;

/**
 * Build the set of (subject_kind, subject_ref_id) tuples the agent
 * has already published in the last 30 days. Used to drop
 * already-promoted subjects from the suggestion list.
 */
async function loadRecentlyPostedSubjects(
  agentId: string,
): Promise<Set<RecentPostKey>> {
  const cutoffIso = new Date(
    Date.now() - LOOKBACK_DAYS * 86_400_000,
  ).toISOString();

  const { data } = await supabaseAdmin
    .from("lead_posts")
    .select("subject_kind, subject_ref_id")
    .eq("agent_id", agentId)
    .eq("status", "published")
    .gte("published_at", cutoffIso)
    .not("subject_ref_id", "is", null)
    .limit(500);

  const set = new Set<RecentPostKey>();
  for (const r of (data as Array<{
    subject_kind: string | null;
    subject_ref_id: string | null;
  }> | null) ?? []) {
    if (r.subject_kind && r.subject_ref_id) {
      set.add(`${r.subject_kind}:${r.subject_ref_id}`);
    }
  }
  return set;
}

/**
 * Parse the wire-format subject id into its kind + refId components.
 * Subjects emit ids like `listing:<uuid>` or `open_house:<uuid>` —
 * see lib/leads-gen/subjects.ts for the canonical encoding.
 */
function parseSubjectId(
  id: string,
): { kind: string; refId: string } | null {
  const i = id.indexOf(":");
  if (i <= 0) return null;
  return { kind: id.slice(0, i), refId: id.slice(i + 1) };
}

/**
 * Score an open-house subject by how soon it is. The `sub` field
 * follows the format `Date · Time · Address` — we parse just the
 * date prefix to compute days-until.
 *
 * Falls back to score 50 (mid-range) when the date can't be parsed
 * so we don't silently drop valid open-houses from the suggestions
 * pool because of an unexpected format.
 */
function scoreOpenHouse(subject: Subject): {
  urgency: number;
  reason: string;
} {
  if (!subject.sub) return { urgency: 50, reason: "Coming up soon" };
  // The picker label sub-string typically starts with a localized date.
  // Try Date.parse on the first token; if that fails, use the whole.
  const firstChunk = subject.sub.split("·")[0]?.trim() ?? subject.sub;
  const candidate = Date.parse(firstChunk);
  if (!Number.isFinite(candidate)) {
    return { urgency: 50, reason: "Coming up — share a teaser" };
  }
  const hours = (candidate - Date.now()) / (60 * 60 * 1000);
  if (hours <= 48) {
    return { urgency: 100, reason: "Open house in under 48 hours" };
  }
  if (hours <= 24 * 7) {
    return { urgency: 80, reason: "Open house this week" };
  }
  return { urgency: 60, reason: "Upcoming open house" };
}

function scoreNewListing(subject: Subject): {
  urgency: number;
  reason: string;
} {
  // Subjects emitted by getNewListings include "Listed Mar 5" in the
  // sub field when listing_start_date is set. Pull the date for a
  // recency score; default mid-range when not parseable.
  if (!subject.sub) {
    return { urgency: 50, reason: "Hasn't been promoted yet" };
  }
  const match = subject.sub.match(
    /(?:Listed|Created)[\s:]+([A-Za-z]+\s+\d{1,2}(?:,?\s+\d{4})?)/i,
  );
  const dateStr = match?.[1];
  const parsed = dateStr ? Date.parse(dateStr) : NaN;
  if (!Number.isFinite(parsed)) {
    return { urgency: 50, reason: "Hasn't been promoted yet" };
  }
  const days = (Date.now() - parsed) / 86_400_000;
  if (days <= 7) {
    return { urgency: 70, reason: "New listing — hasn't been posted yet" };
  }
  return { urgency: 40, reason: "Could use another push" };
}

function scoreJustSold(_subject: Subject): {
  urgency: number;
  reason: string;
} {
  // Just-solds are time-bounded by the 60-day query in getJustSoldTransactions;
  // anything in the pool is recent enough to celebrate.
  return { urgency: 60, reason: "Just closed — celebrate the win" };
}

/**
 * Returns up to `limit` suggestions ranked by urgency. Empty array
 * when nothing's worth surfacing — the UI shows nothing rather
 * than a stub.
 */
export async function suggestNextPosts(params: {
  agentId: string;
  limit?: number;
}): Promise<NextPostSuggestion[]> {
  const limit = Math.min(Math.max(params.limit ?? 3, 1), 10);

  const [recentlyPosted, newListings, openHouses, justSolds] =
    await Promise.all([
      loadRecentlyPostedSubjects(params.agentId),
      getSubjectsForTrigger("new_listing", params.agentId).catch(
        () => [] as Subject[],
      ),
      getSubjectsForTrigger("open_house", params.agentId).catch(
        () => [] as Subject[],
      ),
      getSubjectsForTrigger("just_sold", params.agentId).catch(
        () => [] as Subject[],
      ),
    ]);

  const candidates: NextPostSuggestion[] = [];

  for (const s of openHouses) {
    const parsed = parseSubjectId(s.id);
    if (!parsed) continue;
    if (recentlyPosted.has(`${parsed.kind}:${parsed.refId}`)) continue;
    const { urgency, reason } = scoreOpenHouse(s);
    candidates.push({
      trigger: "open_house",
      subjectId: s.id,
      label: s.label,
      sub: s.sub,
      reason,
      urgency,
    });
  }

  for (const s of newListings) {
    const parsed = parseSubjectId(s.id);
    if (!parsed) continue;
    if (recentlyPosted.has(`${parsed.kind}:${parsed.refId}`)) continue;
    const { urgency, reason } = scoreNewListing(s);
    candidates.push({
      trigger: "new_listing",
      subjectId: s.id,
      label: s.label,
      sub: s.sub,
      reason,
      urgency,
    });
  }

  for (const s of justSolds) {
    const parsed = parseSubjectId(s.id);
    if (!parsed) continue;
    if (recentlyPosted.has(`${parsed.kind}:${parsed.refId}`)) continue;
    const { urgency, reason } = scoreJustSold(s);
    candidates.push({
      trigger: "just_sold",
      subjectId: s.id,
      label: s.label,
      sub: s.sub,
      reason,
      urgency,
    });
  }

  candidates.sort((a, b) => b.urgency - a.urgency);
  return candidates.slice(0, limit);
}
