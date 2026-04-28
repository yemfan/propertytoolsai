/**
 * Pure status logic for Buyer Broker Agreements.
 *
 * Three predicates the rest of the CRM cares about:
 *   1. canShowProperty(bba, now) — gate for scheduling a showing.
 *      True iff signed + not expired + not terminated
 *   2. renewalStatus(bba, now) — drives the dashboard chip + the
 *      renewal-reminder cron. 'expiring_soon' triggers an email
 *      to the agent
 *   3. effectiveStatus(bba, now) — collapses persisted status +
 *      time-based expiry into a single canonical state. The DB
 *      column says 'signed' even past end_date; this function
 *      returns 'expired' when the signed BBA has aged out
 *
 * Default expiry-soon window is 30 days; configurable.
 *
 * Pure — vitest covers each branch.
 */

export type BbaStatus =
  | "draft"
  | "sent"
  | "signed"
  | "declined"
  | "expired"
  | "terminated";

export type BbaInput = {
  status: BbaStatus;
  signedAt: string | null;
  effectiveStartDate: string | null;
  effectiveEndDate: string | null;
  terminatedAt: string | null;
};

export type RenewalStatus =
  | "missing"
  | "draft"
  | "sent_awaiting_signature"
  | "active"
  | "expiring_soon"
  | "expired"
  | "terminated";

/**
 * Canonical "is this BBA usable RIGHT NOW?" predicate. The
 * showing scheduler / transaction creator should call this
 * before allowing the agent to act on a buyer.
 */
export function canShowProperty(
  bba: BbaInput | null,
  nowIso: string,
): boolean {
  if (!bba) return false;
  if (bba.status !== "signed") return false;
  if (bba.terminatedAt) return false;

  if (bba.effectiveEndDate) {
    const endMs = parseDateMs(bba.effectiveEndDate);
    const nowMs = Date.parse(nowIso);
    if (Number.isFinite(endMs) && Number.isFinite(nowMs) && endMs < nowMs) {
      return false;
    }
  }
  return true;
}

/**
 * Days remaining until the BBA expires. Returns null when the
 * BBA has no end date set (open-ended) or when it's already
 * past expiry. Floor-rounded — partial days don't count.
 */
export function daysUntilExpiry(
  bba: BbaInput,
  nowIso: string,
): number | null {
  if (!bba.effectiveEndDate) return null;
  const endMs = parseDateMs(bba.effectiveEndDate);
  const nowMs = Date.parse(nowIso);
  if (!Number.isFinite(endMs) || !Number.isFinite(nowMs)) return null;
  const diff = endMs - nowMs;
  if (diff < 0) return null;
  return Math.floor(diff / 86_400_000);
}

/**
 * Single-string status the agent dashboard renders as a chip.
 * Combines persisted status with time-based expiry.
 *
 * `expiringSoonDays` is the threshold for 'expiring_soon' — the
 * window where the renewal-reminder cron should ping the agent.
 * Default 30 days.
 */
export function renewalStatus(
  bba: BbaInput | null,
  nowIso: string,
  opts: { expiringSoonDays?: number } = {},
): RenewalStatus {
  if (!bba) return "missing";
  if (bba.status === "draft") return "draft";
  if (bba.status === "sent") return "sent_awaiting_signature";
  if (bba.status === "declined") return "missing"; // declined collapses to "no agreement on file"
  if (bba.status === "terminated") return "terminated";
  if (bba.status === "expired") return "expired";

  // bba.status === "signed" — apply time-based expiry on top.
  if (bba.terminatedAt) return "terminated";
  if (!bba.effectiveEndDate) return "active";

  const endMs = parseDateMs(bba.effectiveEndDate);
  const nowMs = Date.parse(nowIso);
  if (!Number.isFinite(endMs) || !Number.isFinite(nowMs)) return "active";
  if (endMs < nowMs) return "expired";

  const threshold = (opts.expiringSoonDays ?? 30) * 86_400_000;
  if (endMs - nowMs <= threshold) return "expiring_soon";
  return "active";
}

/** Parse YYYY-MM-DD as midnight UTC (DATE columns serialize this way). */
function parseDateMs(s: string): number {
  // If it already looks like an ISO timestamp, Date.parse handles it.
  if (/T\d/.test(s)) return Date.parse(s);
  // For a bare YYYY-MM-DD, treat as end-of-day local-ish (23:59:59) so
  // a BBA with end_date=2026-12-31 is still usable through that day.
  return Date.parse(`${s}T23:59:59Z`);
}
