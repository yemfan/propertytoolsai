import type { TransactionRow } from "@/lib/transactions/types";

/**
 * Pure commission-forecast aggregator.
 *
 * The existing RevenuePanel covers EARNED commission (status='closed' AND
 * closing_date_actual set) thoroughly. This module covers the other half:
 * IN-FLIGHT commission — active + pending deals weighted by close-date
 * proximity so the agent sees a realistic "what's actually about to land
 * vs. what's still aspirational" forecast.
 *
 * Why proximity-weighting:
 *   * A deal closing in 14 days with mutual-acceptance signed is
 *     near-certain — weight near 1.0
 *   * A deal closing in 90 days is materially less certain (financing,
 *     inspection, appraisal can still kill it) — discount accordingly
 *   * A "pending" deal whose close date is past-due signals a slipped
 *     timeline (renegotiation, contingency issue) — heavy discount
 *
 * The exact discount curve is a judgment call, not a model. Keeping the
 * weights here as named constants so they're easy to tune as we collect
 * data on what actually closes vs. what doesn't.
 */

/** Slim row shape — only what the bucketer needs. Keeps this module
 *  decoupled from the full TransactionRow (and thus from the schema). */
export type ForecastInputRow = {
  id: string;
  transactionType: TransactionRow["transaction_type"];
  status: TransactionRow["status"];
  propertyAddress: string;
  closingDate: string | null;
  grossCommission: number | null;
  agentNetCommission: number | null;
  mutualAcceptanceDate: string | null;
};

/**
 * Confidence weight for an in-flight deal based on days to scheduled close.
 *
 *   past-due           → 0.40  (timeline slipped — heavy discount)
 *   missing close-date → 0.30  (no anchor at all — heaviest discount)
 *   0-30 days          → 0.90  (mutual signed, contingencies in motion)
 *   31-60 days         → 0.75
 *   61-90 days         → 0.60
 *   91-180 days        → 0.40
 *   180+ days          → 0.25  (effectively long-tail; could be listing
 *                                 with no offer yet)
 */
export function weightForCloseDate(
  closingDateIso: string | null,
  nowIso: string,
): number {
  if (!closingDateIso) return 0.3;
  const days = daysBetween(nowIso, closingDateIso);
  if (days == null) return 0.3;
  if (days < 0) return 0.4; // past-due
  if (days <= 30) return 0.9;
  if (days <= 60) return 0.75;
  if (days <= 90) return 0.6;
  if (days <= 180) return 0.4;
  return 0.25;
}

export type MonthlyForecastBucket = {
  /** "YYYY-MM" — also used as the sort key. */
  month: string;
  /** Display label like "Jun 26". */
  label: string;
  /** Number of deals scheduled to close this month. */
  count: number;
  /** Sum of gross_commission across the bucket (unweighted). */
  grossCommission: number;
  /** Sum of agent_net_commission across the bucket (unweighted). */
  netCommission: number;
  /** Sum of gross_commission × per-row weight. */
  weightedGross: number;
  /** Sum of agent_net_commission × per-row weight. */
  weightedNet: number;
};

export type ForecastByType = {
  buyer_rep: { count: number; gross: number; net: number; weightedGross: number; weightedNet: number };
  listing_rep: { count: number; gross: number; net: number; weightedGross: number; weightedNet: number };
  dual: { count: number; gross: number; net: number; weightedGross: number; weightedNet: number };
};

export type ForecastSummary = {
  /** Active + pending deals only. Closed deals belong to the Revenue
   *  surface, not this one. */
  totalCount: number;
  /** Sum of gross_commission across all in-flight deals (unweighted). */
  grossCommission: number;
  /** Sum of agent_net_commission across all in-flight deals (unweighted). */
  netCommission: number;
  /** Sum of gross × proximity weight — "expected gross to actually land". */
  weightedGross: number;
  /** Sum of net × proximity weight — "expected take-home". */
  weightedNet: number;
  /** Deals whose closing_date is before nowIso (timeline slipped). */
  pastDueCount: number;
  /** Buckets sorted by month asc (oldest → newest). Past-due rolls into
   *  the bucket of its scheduled close-date month so the timeline is
   *  honest about where the deal was supposed to land. */
  byMonth: MonthlyForecastBucket[];
  /** Per-transaction-type breakdown — useful for buyer-rep vs listing-rep
   *  agents who want to see where their pipeline is concentrated. */
  byType: ForecastByType;
};

/**
 * Build the forecast summary. Pure — caller passes `nowIso` for stable
 * snapshotting (server fetches it from `new Date().toISOString()` once).
 *
 *   * Only `status='active' | 'pending'` rows are included. The caller
 *     is expected to pre-filter, but we double-check here so misuse
 *     doesn't silently inflate the forecast with closed deals.
 */
export function buildForecastSummary(
  rows: ReadonlyArray<ForecastInputRow>,
  nowIso: string,
): ForecastSummary {
  const inFlight = rows.filter((r) => r.status === "active" || r.status === "pending");

  let grossCommission = 0;
  let netCommission = 0;
  let weightedGross = 0;
  let weightedNet = 0;
  let pastDueCount = 0;

  const byMonth = new Map<string, MonthlyForecastBucket>();
  const byType: ForecastByType = {
    buyer_rep: { count: 0, gross: 0, net: 0, weightedGross: 0, weightedNet: 0 },
    listing_rep: { count: 0, gross: 0, net: 0, weightedGross: 0, weightedNet: 0 },
    dual: { count: 0, gross: 0, net: 0, weightedGross: 0, weightedNet: 0 },
  };

  for (const r of inFlight) {
    const gross = r.grossCommission ?? 0;
    const net = r.agentNetCommission ?? 0;
    const weight = weightForCloseDate(r.closingDate, nowIso);
    const wGross = gross * weight;
    const wNet = net * weight;

    grossCommission += gross;
    netCommission += net;
    weightedGross += wGross;
    weightedNet += wNet;

    if (r.closingDate) {
      const days = daysBetween(nowIso, r.closingDate);
      if (days != null && days < 0) pastDueCount += 1;
    }

    // Month bucket — use scheduled closing_date. When missing, file under
    // "no-date" so the agent sees the gap explicitly instead of having
    // it absorbed into the current month silently.
    const monthKey = r.closingDate ? r.closingDate.slice(0, 7) : "no-date";
    const existing = byMonth.get(monthKey);
    const bucket = existing ?? {
      month: monthKey,
      label: monthKey === "no-date" ? "No close date" : formatMonthLabel(monthKey),
      count: 0,
      grossCommission: 0,
      netCommission: 0,
      weightedGross: 0,
      weightedNet: 0,
    };
    bucket.count += 1;
    bucket.grossCommission = round2(bucket.grossCommission + gross);
    bucket.netCommission = round2(bucket.netCommission + net);
    bucket.weightedGross = round2(bucket.weightedGross + wGross);
    bucket.weightedNet = round2(bucket.weightedNet + wNet);
    byMonth.set(monthKey, bucket);

    // Type breakdown.
    const typeBucket = byType[r.transactionType];
    typeBucket.count += 1;
    typeBucket.gross = round2(typeBucket.gross + gross);
    typeBucket.net = round2(typeBucket.net + net);
    typeBucket.weightedGross = round2(typeBucket.weightedGross + wGross);
    typeBucket.weightedNet = round2(typeBucket.weightedNet + wNet);
  }

  return {
    totalCount: inFlight.length,
    grossCommission: round2(grossCommission),
    netCommission: round2(netCommission),
    weightedGross: round2(weightedGross),
    weightedNet: round2(weightedNet),
    pastDueCount,
    byMonth: sortMonthsForecastSafe([...byMonth.values()]),
    byType,
  };
}

/**
 * Sort months asc by month key. The "no-date" sentinel always sorts LAST
 * so the timeline reads chronologically from left to right with the
 * "no anchor" bucket as a clearly-separated tail.
 */
function sortMonthsForecastSafe(
  buckets: MonthlyForecastBucket[],
): MonthlyForecastBucket[] {
  return [...buckets].sort((a, b) => {
    if (a.month === "no-date" && b.month !== "no-date") return 1;
    if (b.month === "no-date" && a.month !== "no-date") return -1;
    return a.month < b.month ? -1 : a.month > b.month ? 1 : 0;
  });
}

function daysBetween(fromIso: string, toIso: string): number | null {
  const fromDate = parseDate(fromIso);
  const toDate = parseDate(toIso);
  if (fromDate == null || toDate == null) return null;
  return Math.round((toDate - fromDate) / 86_400_000);
}

function parseDate(iso: string): number | null {
  if (!iso) return null;
  const [yStr, mStr, dStr] = iso.slice(0, 10).split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  const d = Number(dStr);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  return Date.UTC(y, m - 1, d);
}

function formatMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m)) return monthKey;
  const d = new Date(Date.UTC(y, m - 1, 1));
  return d.toLocaleDateString("en-US", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  });
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
