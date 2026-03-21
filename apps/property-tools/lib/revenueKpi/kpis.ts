import type { DailyRevenuePoint, KpiSummary } from "./types";

export function pctChange(current: number, prior: number): number | null {
  if (!Number.isFinite(prior) || prior === 0) return null;
  return Number((((current - prior) / prior) * 100).toFixed(2));
}

export function buildKpiSummary(params: {
  windowDays: number;
  revenueCents: number;
  revenueCentsPrior: number;
  transactionCount: number;
  funnelSessions: number;
  leadEvents: number;
  pageViewEvents: number;
  purchaseEvents: number;
}): KpiSummary {
  const {
    windowDays,
    revenueCents,
    revenueCentsPrior,
    transactionCount,
    funnelSessions,
    leadEvents,
    pageViewEvents,
    purchaseEvents,
  } = params;

  const avgDealCents =
    transactionCount > 0 ? Math.round(revenueCents / transactionCount) : null;

  let funnelConversionPct: number | null = null;
  if (pageViewEvents > 0 && purchaseEvents >= 0) {
    funnelConversionPct = Number(((purchaseEvents / pageViewEvents) * 100).toFixed(2));
  }

  return {
    windowDays,
    revenueCents,
    revenueCentsPrior,
    revenueMomPct: pctChange(revenueCents, revenueCentsPrior),
    transactionCount,
    avgDealCents,
    funnelSessions,
    leadEvents,
    funnelConversionPct,
  };
}

export function bucketDailyRevenue(
  rows: { occurred_at: string; amount_cents: number }[],
  windowStart: Date,
  windowEnd: Date
): DailyRevenuePoint[] {
  const dayKey = (iso: string) => iso.slice(0, 10);
  const map = new Map<string, { revenueCents: number; transactions: number }>();

  const cursor = new Date(windowStart);
  while (cursor <= windowEnd) {
    map.set(dayKey(cursor.toISOString()), { revenueCents: 0, transactions: 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  for (const r of rows) {
    const k = dayKey(r.occurred_at);
    if (!map.has(k)) continue;
    const cur = map.get(k)!;
    cur.revenueCents += Number(r.amount_cents);
    cur.transactions += 1;
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, v]) => ({
      day,
      revenueCents: v.revenueCents,
      transactions: v.transactions,
    }));
}
