/**
 * ZIP-level market data — queries the market_snapshots table for
 * recent PPSF data at the ZIP code level, which is more granular
 * than city-wide data.
 *
 * In mixed-market cities (e.g., LA, Chicago), ZIP-level PPSF can
 * differ by 2-3× from the city median. Using ZIP data when available
 * significantly improves estimate accuracy.
 */

import { supabaseServer } from "@/lib/supabaseServer";

export type ZipMarketData = {
  medianPpsf: number;
  medianPrice: number | null;
  compCount: number | null;
  yoyTrendPct: number | null;
  avgDaysOnMarket: number | null;
  snapshotDate: string;
};

/**
 * Fetch the most recent market snapshot for a ZIP code.
 * Returns null if no data exists (caller should fall back to city-level).
 *
 * Looks back up to 30 days for fresh data.
 */
export async function getZipMarketPpsf(
  zip: string | null
): Promise<ZipMarketData | null> {
  if (!zip?.trim()) return null;

  const cleanZip = zip.trim().slice(0, 5);
  if (!/^\d{5}$/.test(cleanZip)) return null;

  // Look for snapshots within the last 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  try {
    const { data, error } = await supabaseServer
      .from("market_snapshots")
      .select(
        "median_ppsf,median_price,comp_count,yoy_trend_pct,avg_days_on_market,snapshot_date"
      )
      .eq("zip", cleanZip)
      .gte("snapshot_date", thirtyDaysAgo)
      .order("snapshot_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;

    const ppsf = Number(data.median_ppsf);
    if (!ppsf || ppsf <= 0) return null;

    return {
      medianPpsf: ppsf,
      medianPrice: data.median_price ?? null,
      compCount: data.comp_count ?? null,
      yoyTrendPct: data.yoy_trend_pct ?? null,
      avgDaysOnMarket: data.avg_days_on_market ?? null,
      snapshotDate: data.snapshot_date,
    };
  } catch (e) {
    console.error(`[zipMarketData] ZIP ${cleanZip} query failed:`, e);
    return null;
  }
}
