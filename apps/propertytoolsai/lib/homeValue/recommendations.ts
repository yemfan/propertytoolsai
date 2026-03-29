/**
 * Home value recommendation engine — blends likely intent, estimate, confidence,
 * comps, local market, and optional client intent signals into next-step tool links.
 */

import type {
  ConfidenceOutput,
  HomeValueEstimateOutput,
  IntentSignals,
  NormalizedProperty,
  ToolkitRecommendation,
  UserIntent,
} from "./types";

const BASE = "";

export type HomeValueRecommendationInput = {
  /** Applied intent (explicit or inferred). */
  intent: UserIntent;
  estimate: HomeValueEstimateOutput;
  confidence: ConfidenceOutput;
  comps: { pricedCount: number; totalConsidered: number };
  market: {
    city: string;
    state: string;
    trend: "up" | "down" | "stable";
    medianPrice: number | null;
    pricePerSqft: number | null;
    source: string;
  };
  /** Client intent_signals from last estimate request (optional). */
  signals?: Partial<IntentSignals>;
  /** For property-type nuance in copy. */
  propertyType?: string | null;
  normalizedProperty?: Pick<NormalizedProperty, "missingFields">;
};

function trendClause(trend: "up" | "down" | "stable", city: string): string {
  const c = city && city !== "Unknown" ? city : "Local";
  if (trend === "up") return `${c} market momentum is positive — stress-test numbers before you commit.`;
  if (trend === "down") return `${c} has softer momentum — use tools to validate range and timing.`;
  return `${c} conditions look balanced — cross-check with comps-driven tools.`;
}

function compClause(pricedCount: number, totalConsidered: number): string {
  if (pricedCount >= 5) return `Strong comp coverage (${pricedCount} priced sales) supports these next steps.`;
  if (pricedCount >= 1)
    return `${pricedCount} comparable sale${pricedCount === 1 ? "" : "s"} priced — broaden with compare & CMA tools.`;
  return totalConsidered > 0
    ? "Few priced comps in range — comparisons and CMA help anchor value."
    : "Limited nearby sales — use comparisons and pro review to tighten the story.";
}

function confidenceClause(confidence: ConfidenceOutput): string {
  if (confidence.level === "high") return "Estimate confidence is high — good moment to go deeper.";
  if (confidence.level === "medium")
    return "Confidence is medium — refine inputs or add CMA context for listing or offers.";
  return "Confidence is lower — prioritize CMA, comps, and local expert review.";
}

function signalClause(signals: Partial<IntentSignals> | undefined): string {
  if (!signals) return "";
  if (signals.askedForCma) return " You already leaned toward CMA — finish with a full report.";
  if (signals.expertHelpClicked) return " You explored expert help — continue with listing or pricing tools.";
  if (signals.mortgageAfterEstimate) return " You checked mortgage context — keep stress-testing payment vs value.";
  if (signals.comparisonToolUsed) return " You used comparison before — extend it for side-by-side ranking.";
  if (signals.rentOrRoiOrCapToolUsed) return " You explored rent/ROI — layer that on this value band.";
  return "";
}

function isMultifamily(propertyType: string | null | undefined): boolean {
  return /\bmulti|duplex|triplex|fourplex/i.test(String(propertyType ?? ""));
}

/**
 * Primary API — three ranked toolkit links per intent with contextual reasons.
 */
export function buildHomeValueRecommendations(input: HomeValueRecommendationInput): ToolkitRecommendation[] {
  const { intent, estimate, confidence, comps, market, signals, propertyType, normalizedProperty } = input;
  const missing = normalizedProperty?.missingFields?.length ?? 0;
  const missingHint =
    missing > 0
      ? ` ${missing} detail${missing === 1 ? " is" : "s are"} still missing — refining strengthens every step below.`
      : "";

  const baseContext = [confidenceClause(confidence), trendClause(market.trend, market.city), compClause(comps.pricedCount, comps.totalConsidered)]
    .filter(Boolean)
    .join(" ");
  const sig = signalClause(signals);

  if (intent === "seller") {
    return [
      {
        title: "Get a detailed CMA report",
        href: `${BASE}/smart-cma-builder`,
        reason: `${baseContext}${sig}${missingHint}`.trim(),
        intent: "seller",
      },
      {
        title: "Compare your home with recent sales nearby",
        href: `${BASE}/ai-property-comparison`,
        reason: `Side-by-side with recent sales in ${market.city || "your area"}. ${compClause(comps.pricedCount, comps.totalConsidered)}`,
        intent: "seller",
      },
      {
        title: "Talk to a local listing expert",
        href: `${BASE}/pricing`,
        reason: `List near ${estimate.point ? `$${Math.round(estimate.point).toLocaleString()}` : "this value"}? Match with tools and advisor support.${missingHint}`,
        intent: "seller",
      },
    ];
  }

  if (intent === "buyer") {
    return [
      {
        title: "Estimate mortgage for this property",
        href: `${BASE}/mortgage-calculator`,
        reason: `Payment stress-test against ~${estimate.point ? `$${Math.round(estimate.point).toLocaleString()}` : "this"} midpoint. ${trendClause(market.trend, market.city)}`,
        intent: "buyer",
      },
      {
        title: "Compare this home with similar options",
        href: `${BASE}/ai-property-comparison`,
        reason: `${baseContext}${sig}${missingHint}`.trim(),
        intent: "buyer",
      },
      {
        title: "See AI-recommended alternatives nearby",
        href: `${BASE}/ai-property-comparison`,
        reason: `Rank alternatives using AI comparison — especially useful when ${comps.pricedCount < 3 ? "comps are thin" : "you want optionality"}.`,
        intent: "buyer",
      },
    ];
  }

  // investor
  const mf = isMultifamily(propertyType);
  return [
    {
      title: "Estimate rental income",
      href: `${BASE}/rental-property-analyzer`,
      reason: mf
        ? `Income approach for ${propertyType ?? "this"} asset on ~${estimate.point ? `$${Math.round(estimate.point).toLocaleString()}` : "this"} basis.`
        : `Project rent on top of ~${estimate.point ? `$${Math.round(estimate.point).toLocaleString()}` : "this"} value. ${trendClause(market.trend, market.city)}`,
      intent: "investor",
    },
    {
      title: "Analyze ROI and cash flow",
      href: `${BASE}/cap-rate-calculator`,
      reason: `${baseContext}${sig} Tie cap rate and cash-on-cash to this estimate band.${missingHint}`.trim(),
      intent: "investor",
    },
    {
      title: "Use AI Property Comparison for deal ranking",
      href: `${BASE}/ai-property-comparison`,
      reason: `Stack candidates vs this deal using ${comps.pricedCount ? `${comps.pricedCount} local priced comps` : "available market context"} as a baseline.`,
      intent: "investor",
    },
  ];
}

/**
 * @deprecated Prefer {@link buildHomeValueRecommendations} with full context.
 * Fallback when only intent is known (tests / legacy).
 */
export function getToolkitRecommendations(intent: UserIntent): ToolkitRecommendation[] {
  return buildHomeValueRecommendations({
    intent,
    estimate: {
      point: 0,
      low: 0,
      high: 0,
      baselinePpsf: 0,
      adjustments: [],
      summary: "",
    },
    confidence: {
      level: "medium",
      score: 50,
      bandPct: 0.1,
      factors: [],
      explanation: "",
    },
    comps: { pricedCount: 0, totalConsidered: 0 },
    market: { city: "", state: "", trend: "stable", medianPrice: null, pricePerSqft: null, source: "" },
  });
}
