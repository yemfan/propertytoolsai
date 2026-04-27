import {
  bucketKeyFor,
  labelForSourceKey,
  sourceKeySortIndex,
} from "@/lib/leadSourceRoi/displayNames";
import type {
  LeadSourceRoiInputContact,
  LeadSourceRoiReport,
  LeadSourceRoiRow,
} from "@/lib/leadSourceRoi/types";

/**
 * Pure aggregator: contacts → per-source ROI rows + roll-up totals.
 *
 * "Won" rule: `lifecycle_stage = 'past_client'` is the schema's terminal-
 * success state. Some flows skip `lead_status='won'` (e.g. agent-imported
 * past clients), so the lifecycle field is the authoritative signal.
 *
 * "Qualified" rule: `lead_status IN ('qualified','won')` OR lifecycle is
 * past_client (because won implies qualified). Captures both the funnel-
 * advance signal and the closed-deal signal.
 *
 * Avg / total volume: only counts rows where `lifecycle_stage='past_client'`
 * AND `closing_price > 0` — guards against partial-data past clients
 * (closed deal without a price entered) inflating the avg.
 */

function isWon(c: LeadSourceRoiInputContact): boolean {
  return c.lifecycleStage === "past_client";
}

function isQualified(c: LeadSourceRoiInputContact): boolean {
  if (isWon(c)) return true;
  const s = (c.leadStatus ?? "").toLowerCase();
  return s === "qualified" || s === "won";
}

function daysBetween(startIso: string, endIso: string): number | null {
  const a = new Date(startIso).getTime();
  const b = new Date(endIso).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function aggregateBySource(
  contacts: ReadonlyArray<LeadSourceRoiInputContact>,
  startDate: string,
  endDate: string,
): LeadSourceRoiReport {
  const buckets = new Map<string, LeadSourceRoiInputContact[]>();
  for (const c of contacts) {
    const key = bucketKeyFor(c.source);
    const list = buckets.get(key) ?? [];
    list.push(c);
    buckets.set(key, list);
  }

  const rows: LeadSourceRoiRow[] = [];
  for (const [sourceKey, items] of buckets.entries()) {
    const leads = items.length;
    let qualified = 0;
    let won = 0;
    let totalVolume = 0;
    let volumeCount = 0;
    let totalDaysToClose = 0;
    let daysToCloseCount = 0;

    for (const c of items) {
      if (isQualified(c)) qualified++;
      if (isWon(c)) {
        won++;
        if (c.closingPrice != null && Number.isFinite(c.closingPrice) && c.closingPrice > 0) {
          totalVolume += c.closingPrice;
          volumeCount++;
        }
        if (c.closingDate) {
          const d = daysBetween(c.createdAt, c.closingDate);
          if (d != null) {
            totalDaysToClose += d;
            daysToCloseCount++;
          }
        }
      }
    }

    rows.push({
      sourceKey,
      sourceLabel: labelForSourceKey(sourceKey),
      leads,
      qualified,
      won,
      conversionPct: leads > 0 ? round2((won / leads) * 100) : 0,
      totalVolume: round2(totalVolume),
      avgDealValue: volumeCount > 0 ? round2(totalVolume / volumeCount) : 0,
      avgDaysToClose:
        daysToCloseCount > 0 ? round2(totalDaysToClose / daysToCloseCount) : null,
    });
  }

  // Default sort: highest revenue contributors first, then conversion %, then
  // lead volume, with a deterministic tail-break by sourceKeySortIndex.
  rows.sort((a, b) => {
    if (b.totalVolume !== a.totalVolume) return b.totalVolume - a.totalVolume;
    if (b.conversionPct !== a.conversionPct) return b.conversionPct - a.conversionPct;
    if (b.leads !== a.leads) return b.leads - a.leads;
    return sourceKeySortIndex(a.sourceKey) - sourceKeySortIndex(b.sourceKey);
  });

  // Roll-up totals across every row.
  let tLeads = 0;
  let tQualified = 0;
  let tWon = 0;
  let tVolume = 0;
  let tVolumeCount = 0;
  for (const r of rows) {
    tLeads += r.leads;
    tQualified += r.qualified;
    tWon += r.won;
    tVolume += r.totalVolume;
    if (r.avgDealValue > 0 && r.won > 0) {
      // Reconstruct the volume-eligible count from the row's avg + total
      // so the global avg is properly volume-weighted, not row-weighted.
      tVolumeCount += Math.round(r.totalVolume / r.avgDealValue);
    }
  }

  return {
    startDate,
    endDate,
    rows,
    totals: {
      leads: tLeads,
      qualified: tQualified,
      won: tWon,
      conversionPct: tLeads > 0 ? round2((tWon / tLeads) * 100) : 0,
      totalVolume: round2(tVolume),
      avgDealValue: tVolumeCount > 0 ? round2(tVolume / tVolumeCount) : 0,
    },
  };
}
