/**
 * Intent signal scoring — maps behavioral + address signals to seller / buyer / investor buckets.
 * See intentInference.ts for orchestration with explicit user choice + property heuristics.
 */

import type { IntentSignals, LikelyIntent, UserIntent } from "./types";

export type IntentScores = {
  seller: number;
  buyer: number;
  investor: number;
};

/** Example weights from product spec + supporting signals. */
const WEIGHTS = {
  homeValueUsed: { seller: 25 },
  fullReportUnlocked: { seller: 15 },
  askedForCma: { seller: 20 },
  expertHelpClicked: { seller: 10 },
  revisitSameAddress: { seller: 15 },
  listingLikeAddress: { buyer: 20 },
  mortgageAfterEstimate: { buyer: 15 },
  comparisonToolUsed: { buyer: 10, investor: 10 },
  rentOrRoiOrCapToolUsed: { investor: 20 },
  /** Extra weight when user compared multiple properties (same session / cross-tool). */
  comparesMultipleProperties: { buyer: 8, investor: 8 },
  priceVsValueFocus: { investor: 15 },
} as const;

/** Spread of estimate band vs point — wide band suggests investor-style scrutiny. */
export function priceSpreadImpliesValueFocus(ratio: number | null | undefined): boolean {
  if (ratio == null || !Number.isFinite(ratio) || ratio < 0) return false;
  return ratio >= 0.12;
}

/**
 * Heuristic: MLS/unit/apt patterns often correlate with “buying a listed unit”.
 */
export function looksLikeListingAddress(address: string): boolean {
  const s = address.trim();
  if (!s) return false;
  if (/\b(mls|listing)\b/i.test(s)) return true;
  if (/#\s*\w+/i.test(s)) return true;
  if (/\b(unit|apt|apartment|suite|ste)\b\.?\s+[a-z0-9]+/i.test(s)) return true;
  if (/\b\d+[a-z]?\s*[-–]\s*\d+\b/.test(s) && s.length < 80) return true;
  return false;
}

export function scoreIntentSignals(signals: Partial<IntentSignals> | undefined): IntentScores {
  const s = signals ?? {};
  const out: IntentScores = { seller: 0, buyer: 0, investor: 0 };

  const add = (role: keyof IntentScores, n: number) => {
    out[role] += n;
  };

  if (s.homeValueUsed) add("seller", WEIGHTS.homeValueUsed.seller);
  if (s.fullReportUnlocked) add("seller", WEIGHTS.fullReportUnlocked.seller);
  if (s.askedForCma) add("seller", WEIGHTS.askedForCma.seller);
  if (s.expertHelpClicked) add("seller", WEIGHTS.expertHelpClicked.seller);
  if (s.revisitSameAddress) add("seller", WEIGHTS.revisitSameAddress.seller);

  if (s.listingLikeAddress) add("buyer", WEIGHTS.listingLikeAddress.buyer);
  if (s.mortgageAfterEstimate) add("buyer", WEIGHTS.mortgageAfterEstimate.buyer);

  if (s.comparisonToolUsed) {
    add("buyer", WEIGHTS.comparisonToolUsed.buyer);
    add("investor", WEIGHTS.comparisonToolUsed.investor);
  }
  if (s.comparesMultipleProperties) {
    add("buyer", WEIGHTS.comparesMultipleProperties.buyer);
    add("investor", WEIGHTS.comparesMultipleProperties.investor);
  }

  if (s.rentOrRoiOrCapToolUsed) add("investor", WEIGHTS.rentOrRoiOrCapToolUsed.investor);
  if (s.priceVsValueFocus) add("investor", WEIGHTS.priceVsValueFocus.investor);

  return out;
}

export function applyPropertyTypeHeuristics(
  scores: IntentScores,
  propertyType: string | null | undefined
): { scores: IntentScores; tags: string[] } {
  const t = String(propertyType ?? "").toLowerCase();
  const tags: string[] = [];
  const next = { ...scores };

  if (t.includes("condo") || t.includes("apartment")) {
    next.buyer += 10;
    tags.push("heuristic:condo_lean_buyer");
  }
  if (t.includes("multi")) {
    next.investor += 12;
    tags.push("heuristic:multifamily_lean_investor");
  }

  return { scores: next, tags };
}

/**
 * Tie-break when scores tie: seller > buyer > investor.
 */
export function pickLikelyIntentFromScores(scores: IntentScores): LikelyIntent {
  const { seller, buyer, investor } = scores;
  const max = Math.max(seller, buyer, investor);
  if (max <= 0) return "unknown";

  if (seller === max) return "seller";
  if (buyer === max) return "buyer";
  return "investor";
}

export function likelyIntentToUserIntent(likely: LikelyIntent): UserIntent {
  if (likely === "unknown") return "seller";
  return likely;
}
