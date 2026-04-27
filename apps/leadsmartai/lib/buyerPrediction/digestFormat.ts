import type { LikelyBuyerRow } from "@/lib/buyerPrediction/service";

/**
 * Pure formatters / pickers for the SOI buyer-digest cron. Mirrors
 * `lib/spherePrediction/digestFormat.ts` — same DEDUP_DAYS / DIGEST_TOP_N,
 * same picker semantics, different SMS copy.
 *
 * Lives in its own file (not `dailyDigestCron.ts`) so vitest can hit it
 * without the `server-only` shim.
 */

/** Same window as the seller digest — 30d matches SOI farming cadence. */
export const BUYER_DEDUP_DAYS = 30;

/** Cap on candidates surfaced in a single SMS. Keeps the message readable. */
export const BUYER_DIGEST_TOP_N = 5;

/**
 * Given today's ranked list and the set of contacts already notified in the
 * dedup window, return rows for today's digest. Filtered to label==="high"
 * for the same reason as the seller digest — high-priority actionables only;
 * medium / low candidates stay on the pull dashboard.
 */
export function pickNewHighBuyerCandidates(
  ranked: ReadonlyArray<LikelyBuyerRow>,
  alreadyNotifiedIds: ReadonlySet<string>,
): LikelyBuyerRow[] {
  return ranked.filter(
    (r) => r.label === "high" && !alreadyNotifiedIds.has(r.contactId),
  );
}

/**
 * Build the buyer-digest SMS body. Wording differs from the seller digest:
 *
 *   Seller: "X likely sellers in your sphere today" (focuses on listing the home)
 *   Buyer:  "X contacts likely to buy their next home" (focuses on next purchase)
 *
 * Returns null when there is nothing to send.
 */
export function buildBuyerDigestSms(
  candidates: ReadonlyArray<LikelyBuyerRow>,
  agentFirstName: string | null = null,
): string | null {
  if (candidates.length === 0) return null;
  const greeting = agentFirstName?.trim() ? `${agentFirstName.trim()}, ` : "";
  const head =
    candidates.length === 1
      ? `${greeting}1 contact likely to buy their next home today.`
      : `${greeting}${candidates.length} contacts likely to buy their next home today.`;

  const top = candidates.slice(0, BUYER_DIGEST_TOP_N);
  const lines = top.map((c, i) => {
    // Same parenthetical strip as the seller digest — saves SMS chars
    // without losing meaning (full breakdown lives on the dashboard).
    const reason = c.topReason
      .replace(/\s*\(AVM age [^)]+\)/, "")
      .replace(/\s+/g, " ")
      .trim();
    const truncated = reason.length > 70 ? reason.slice(0, 67) + "…" : reason;
    return `${i + 1}. ${c.fullName} (${c.score}) — ${truncated}`;
  });

  const more =
    candidates.length > BUYER_DIGEST_TOP_N
      ? `\n+${candidates.length - BUYER_DIGEST_TOP_N} more on the dashboard.`
      : "";
  const tail = "\nOpen LeadSmart to draft AI outreach.";

  return [head, ...lines].join("\n") + more + tail;
}
