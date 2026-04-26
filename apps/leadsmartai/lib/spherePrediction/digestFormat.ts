import type { LikelySellerRow } from "@/lib/spherePrediction/service";

/**
 * Pure formatters / pickers for the SOI seller-digest cron. Lives in its
 * own file (not `dailyDigestCron.ts`) because that one imports
 * `"server-only"` for its Supabase + Twilio side effects, which trips up
 * vitest's node environment when these helpers are tested directly.
 */

/** How long to suppress re-notification on the same contact. 30d matches SOI farming cadence. */
export const DEDUP_DAYS = 30;

/** Cap on candidates surfaced in a single digest SMS. Keeps the message readable. */
export const DIGEST_TOP_N = 5;

/**
 * Given today's ranked list and the set of contacts already notified in the
 * dedup window, return the rows that should be in today's digest. Filtered
 * to label==="high" because the digest is for high-priority actionables
 * only — medium/low candidates stay on the dashboard pull.
 */
export function pickNewHighCandidates(
  ranked: ReadonlyArray<LikelySellerRow>,
  alreadyNotifiedIds: ReadonlySet<string>,
): LikelySellerRow[] {
  return ranked.filter(
    (r) => r.label === "high" && !alreadyNotifiedIds.has(r.contactId),
  );
}

/**
 * Build the digest SMS body. Caps at top-N candidates with a "+N more" tail
 * for excess. Total length stays under ~640 chars (4 Twilio SMS segments)
 * which is the practical cap before US carriers start dropping segments.
 * Returns null when there is nothing to send.
 */
export function buildDigestSms(
  candidates: ReadonlyArray<LikelySellerRow>,
  agentFirstName: string | null = null,
): string | null {
  if (candidates.length === 0) return null;
  const greeting = agentFirstName?.trim() ? `${agentFirstName.trim()}, ` : "";
  const head =
    candidates.length === 1
      ? `${greeting}1 likely seller in your sphere today.`
      : `${greeting}${candidates.length} likely sellers in your sphere today.`;

  const top = candidates.slice(0, DIGEST_TOP_N);
  const lines = top.map((c, i) => {
    // Strip the "(AVM age Nd — discounted)" parenthetical from equity reasons
    // to save SMS chars; the full breakdown is on the dashboard anyway.
    const reason = c.topReason
      .replace(/\s*\(AVM age [^)]+\)/, "")
      .replace(/\s+/g, " ")
      .trim();
    const truncated = reason.length > 70 ? reason.slice(0, 67) + "…" : reason;
    return `${i + 1}. ${c.fullName} (${c.score}) — ${truncated}`;
  });

  const more =
    candidates.length > DIGEST_TOP_N
      ? `\n+${candidates.length - DIGEST_TOP_N} more on the dashboard.`
      : "";
  const tail = "\nOpen LeadSmart to draft AI messages.";

  return [head, ...lines].join("\n") + more + tail;
}
