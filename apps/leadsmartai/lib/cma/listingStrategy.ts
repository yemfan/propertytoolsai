import type { CmaStrategy, CmaValuation } from "./types";

/**
 * Pure helpers for presenting the listing-strategy bands on the CMA
 * detail page. The bands themselves come from the upstream engine
 * (propertytoolsai/api/smart-cma); this module just wraps them with
 * agent-facing copy and a fallback when the upstream hasn't included
 * them.
 */

export type ListingStrategyKey = "aggressive" | "market" | "premium";

export type ListingStrategyBand = {
  key: ListingStrategyKey;
  label: string;
  /** Recommended list price for this band. */
  price: number;
  /** Projected days on market. Null when the upstream didn't include it. */
  expectedDom: number | null;
  /** One-line agent-facing rationale. */
  rationale: string;
};

const BAND_META: Record<ListingStrategyKey, { label: string; rationale: string }> = {
  aggressive: {
    label: "Aggressive",
    rationale:
      "Underpriced 3–5% to drive multiple offers and a fast close — best when inventory is tight and time-on-market matters.",
  },
  market: {
    label: "Market",
    rationale:
      "Priced at the comp-supported value. Steady showings, fair offers in 2–4 weeks for most inventory.",
  },
  premium: {
    label: "Premium",
    rationale:
      "Stretch 3–5% above market — works when the home has features the comps don't capture (view, lot size, recent reno).",
  },
};

/**
 * Build the per-band display rows from the engine's strategies output.
 * When the engine didn't return strategies (older runs), synthesize
 * sensible defaults from the valuation midpoint so the UI doesn't show
 * an empty section.
 */
export function buildListingStrategyBands(
  strategies: CmaStrategy | null | undefined,
  valuation: CmaValuation,
): ListingStrategyBand[] {
  const order: ListingStrategyKey[] = ["aggressive", "market", "premium"];
  if (strategies) {
    return order.map((key) => ({
      key,
      label: BAND_META[key].label,
      price: roundDollar(strategies[key]),
      expectedDom: pickDom(strategies, key),
      rationale: BAND_META[key].rationale,
    }));
  }

  // Fallback: derive ±4% from the engine's midpoint estimate.
  const mid = Math.max(valuation.estimatedValue, 0);
  return order.map((key) => ({
    key,
    label: BAND_META[key].label,
    price: roundDollar(
      key === "aggressive" ? mid * 0.96 : key === "premium" ? mid * 1.04 : mid,
    ),
    expectedDom: null,
    rationale: BAND_META[key].rationale,
  }));
}

/**
 * Pick the `daysOnMarket` value for a band, defensive against missing
 * fields in older snapshots.
 */
function pickDom(strategies: CmaStrategy, key: ListingStrategyKey): number | null {
  const dom = strategies.daysOnMarket?.[key];
  return typeof dom === "number" && Number.isFinite(dom) ? dom : null;
}

/**
 * Round to whole dollars — list prices below $1 don't make sense and
 * the engine already returns whole dollars; this is belt-and-suspenders
 * against accidental fractional cents.
 */
function roundDollar(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n);
}

/**
 * Compact tag for the CMA list-view row. "Aggressive · 7d" or
 * "Market · est." when DOM is unknown.
 */
export function formatBandTag(band: ListingStrategyBand): string {
  if (band.expectedDom != null) {
    return `${band.label} · ${band.expectedDom}d`;
  }
  return `${band.label} · est.`;
}
