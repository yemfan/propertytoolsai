/**
 * Investment-style property scoring (0–100) with weighted dimensions.
 * Replace with ML later — keep `PropertyInput` + `PropertyScoreResult` stable.
 */

export type PropertyInput = {
  id: string;
  address: string;
  price: number;
  beds: number;
  baths: number;
  sqft: number;
  /** Monthly rent (optional) — improves financial score when present */
  rentMonthly?: number | null;
};

export type PropertyScoreResult = {
  total: number;
  breakdown: {
    financial: number;
    location: number;
    property: number;
    market: number;
  };
  weights: {
    financial: number;
    location: number;
    property: number;
    market: number;
  };
  metrics: {
    pricePerSqft: number;
    estimatedAnnualRoiPct: number | null;
  };
};

const WEIGHTS = {
  financial: 0.4,
  location: 0.3,
  property: 0.2,
  market: 0.1,
} as const;

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return Math.abs(h);
}

/** Deterministic pseudo-market momentum 0–100 from address */
function scoreMarket(address: string): number {
  const h = hashString(address.toLowerCase().trim());
  return 45 + (h % 36); // 45–80
}

/** Heuristic location score from address text (US-centric) */
function scoreLocation(address: string): number {
  const a = address.toUpperCase();
  let base = 55;
  if (/\b(CA|NY|WA|FL|TX|MA|CO|TN|NC|AZ)\b/.test(a)) base += 18;
  if (/\b(CA|NY)\b/.test(a)) base += 7;
  const h = hashString(a);
  base += (h % 15) - 7;
  return clamp(Math.round(base), 35, 95);
}

/** Property condition / layout efficiency */
function scorePropertyDimensions(p: PropertyInput): number {
  const sqft = Math.max(1, p.sqft);
  const beds = Math.max(0, p.beds);
  const baths = Math.max(0, p.baths);
  const roominess = sqft / Math.max(1, beds + baths / 2);
  // Target ~400–900 sqft per bed+bath proxy
  const roomScore = clamp((roominess - 250) / 8, 0, 100);
  const bedBath = baths >= beds * 0.4 ? 70 : 55;
  return clamp(Math.round(roomScore * 0.65 + bedBath * 0.35), 30, 98);
}

/**
 * Financial: favor lower $/sqft and higher rent yield when rent is known.
 */
function scoreFinancial(p: PropertyInput, pricePerSqft: number, roiPct: number | null): number {
  // Normalize $/sqft — assume typical band $80–800
  const pps = clamp((800 - pricePerSqft) / 7.2, 0, 100);
  const yieldScore =
    roiPct !== null ? clamp(roiPct * 4, 0, 100) : 52; // neutral if no rent
  return clamp(Math.round(pps * 0.55 + yieldScore * 0.45), 25, 98);
}

export function pricePerSqft(p: PropertyInput): number {
  const sqft = Math.max(1, p.sqft);
  return p.price / sqft;
}

/** Annual ROI proxy: (monthly rent * 12) / price — cap-rate style */
export function estimatedAnnualRoiPct(p: PropertyInput): number | null {
  const rent = p.rentMonthly;
  if (rent == null || !Number.isFinite(rent) || rent <= 0) return null;
  if (!Number.isFinite(p.price) || p.price <= 0) return null;
  return (rent * 12 * 100) / p.price;
}

/**
 * Weighted investment score 0–100.
 */
export function calculatePropertyScore(property: PropertyInput): PropertyScoreResult {
  const pps = pricePerSqft(property);
  const roi = estimatedAnnualRoiPct(property);

  const financialRaw = scoreFinancial(property, pps, roi);
  const locationRaw = scoreLocation(property.address);
  const propertyRaw = scorePropertyDimensions(property);
  const marketRaw = scoreMarket(property.address);

  const total = clamp(
    Math.round(
      financialRaw * WEIGHTS.financial +
        locationRaw * WEIGHTS.location +
        propertyRaw * WEIGHTS.property +
        marketRaw * WEIGHTS.market
    ),
    0,
    100
  );

  return {
    total,
    breakdown: {
      financial: financialRaw,
      location: locationRaw,
      property: propertyRaw,
      market: marketRaw,
    },
    weights: { ...WEIGHTS },
    metrics: {
      pricePerSqft: Math.round(pps * 100) / 100,
      estimatedAnnualRoiPct: roi !== null ? Math.round(roi * 100) / 100 : null,
    },
  };
}
