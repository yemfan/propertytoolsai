/**
 * Maps lead score → dollar price. Designed to be replaced by dynamic/auction pricing later.
 */

export type LeadPricingOptions = {
  /** Two-letter state, e.g. CA, NY */
  state?: string | null;
  /** Property value in USD (for high-value uplift) */
  property_value?: number | null;
};

export type LeadPricingResult = {
  /** Final USD price after multipliers */
  price: number;
  /** Tier before multipliers */
  basePrice: number;
  /** Combined multiplier applied to base (e.g. 1.5 = +50%) */
  multiplier: number;
  /** Audit trail for UI / ops */
  adjustments: {
    highValueLocation: boolean;
    highValueProperty: boolean;
  };
};

/** Spec: CA, NY → +20% on base tier price */
const HIGH_VALUE_STATES = new Set(["CA", "NY"]);

function tierBasePrice(score: number): number {
  const s = Math.round(Number(score));
  if (s >= 90) return 120;
  if (s >= 80) return 100;
  if (s >= 70) return 80;
  if (s >= 60) return 60;
  if (s >= 50) return 40;
  return 20;
}

function normalizeState(s: string | null | undefined): string | null {
  const t = String(s ?? "")
    .trim()
    .toUpperCase();
  if (t.length === 2) return t;
  return null;
}

/**
 * Score → USD (tiers) with optional CA/NY and high-property-value multipliers.
 */
export function calculateLeadPrice(score: number, options?: LeadPricingOptions): number {
  return calculateLeadPriceDetailed(score, options).price;
}

/**
 * Full quote object — swap for dynamic pricing / ML without changing DB pipeline.
 */
export function calculateLeadPriceDetailed(score: number, options?: LeadPricingOptions): LeadPricingResult {
  const basePrice = tierBasePrice(score);
  const state = normalizeState(options?.state);
  const pv = Number(options?.property_value);

  const highValueLocation = state != null && HIGH_VALUE_STATES.has(state);
  const highValueProperty = Number.isFinite(pv) && pv > 1_500_000;

  let multiplier = 1;
  if (highValueLocation) multiplier *= 1.2;
  if (highValueProperty) multiplier *= 1.25;

  const raw = basePrice * multiplier;
  const price = Math.round(raw * 100) / 100;

  return {
    price,
    basePrice,
    multiplier,
    adjustments: { highValueLocation, highValueProperty },
  };
}

export const LEAD_PRICING_MODEL_VERSION = "tier_v1";

/** Parse two-letter US state from free-text address / location (best-effort). */
export function parseUsStateFromText(text: string | null | undefined): string | null {
  if (!text) return null;
  const s = String(text).trim();
  const zipTail = s.match(/,\s*([A-Za-z]{2})\s+\d{5}(?:-\d{4})?\s*$/);
  if (zipTail) return zipTail[1].toUpperCase();
  const loose = s.match(/\b([A-Za-z]{2})\b(?=\s*(?:\d{5}|$))/g);
  if (loose?.length) {
    const last = loose[loose.length - 1].toUpperCase();
    if (last.length === 2) return last;
  }
  return null;
}
