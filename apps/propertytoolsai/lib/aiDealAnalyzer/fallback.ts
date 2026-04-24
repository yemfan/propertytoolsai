import type {
  DealAnalyzerInputs,
  DealAnalyzerMetrics,
  DealCommentary,
} from "./types";

/**
 * Deterministic rule-based commentary + deal score. Used whenever
 * Claude is unavailable (no API key, rate limited, error, or the
 * response fails validation). The goal: always give the visitor a
 * useful read even if the AI path fails — never an empty panel.
 *
 * Scoring approach is a weighted blend of four signals:
 *   - cash flow strength (40%)
 *   - cap rate vs. market reference (25%)
 *   - cash-on-cash return (25%)
 *   - price-to-rent ratio (10%)
 *
 * Market references are rough national averages for 2026 — intended
 * as a reasonable default, not a precise market-by-market read.
 */
export function buildFallbackCommentary(
  inputs: DealAnalyzerInputs,
  metrics: DealAnalyzerMetrics,
): DealCommentary {
  const { monthlyCashFlow, capRate, cashOnCashReturn, priceToRentRatio } = metrics;

  // ── Score components ─────────────────────────────────────────────
  const cashFlowScore = clamp(0, 100, 50 + monthlyCashFlow / 10);
  // 6% cap rate ~ average US single-family rental. Scale around it.
  const capRateScore = clamp(0, 100, 50 + (capRate - 6) * 8);
  // 8% CoC ~ a common "solid" threshold.
  const cocScore = clamp(0, 100, 50 + (cashOnCashReturn - 8) * 6);
  // Price-to-rent: <15 generally strong, >25 stretched.
  const ptrScore =
    priceToRentRatio <= 0
      ? 50
      : priceToRentRatio < 15
        ? 85
        : priceToRentRatio > 25
          ? 30
          : 85 - (priceToRentRatio - 15) * 5.5;

  const dealScore = Math.round(
    cashFlowScore * 0.4 +
      capRateScore * 0.25 +
      cocScore * 0.25 +
      ptrScore * 0.1,
  );

  // ── Narrative ────────────────────────────────────────────────────
  const strengths: string[] = [];
  const risks: string[] = [];
  const nextMoves: string[] = [];

  if (monthlyCashFlow > 300) {
    strengths.push(
      `Positive monthly cash flow of $${Math.round(monthlyCashFlow)} gives a real margin of safety.`,
    );
  } else if (monthlyCashFlow > 0) {
    strengths.push(
      `Cash flow is modestly positive ($${Math.round(monthlyCashFlow)}/mo) — the deal covers itself.`,
    );
  } else {
    risks.push(
      `Negative cash flow of $${Math.abs(Math.round(monthlyCashFlow))}/mo means you're funding the property out of pocket.`,
    );
    nextMoves.push(
      "Negotiate the price down, increase down payment, or look for a higher-rent comparable in the same submarket.",
    );
  }

  if (capRate >= 7) {
    strengths.push(
      `${capRate.toFixed(1)}% cap rate is above the national average — typical of income-focused markets.`,
    );
  } else if (capRate >= 5) {
    strengths.push(
      `${capRate.toFixed(1)}% cap rate is in a reasonable range for most major markets.`,
    );
  } else if (capRate > 0) {
    risks.push(
      `${capRate.toFixed(1)}% cap rate is below average — this market expects appreciation, not cash flow, to do the work.`,
    );
  }

  if (cashOnCashReturn >= 10) {
    strengths.push(
      `${cashOnCashReturn.toFixed(1)}% cash-on-cash return is strong, especially for a levered rental.`,
    );
  } else if (cashOnCashReturn <= 3 && cashOnCashReturn > 0) {
    risks.push(
      `${cashOnCashReturn.toFixed(1)}% CoC is low — money sitting in a T-bill would earn similarly with less work.`,
    );
    nextMoves.push(
      "Consider putting less cash down (if the cap rate supports it) or finding a deal with better going-in metrics.",
    );
  }

  if (priceToRentRatio > 25 && priceToRentRatio < Infinity) {
    risks.push(
      `Price-to-rent of ${priceToRentRatio.toFixed(1)} is stretched — rents would need to grow significantly to catch up.`,
    );
  } else if (priceToRentRatio > 0 && priceToRentRatio < 15) {
    strengths.push(
      `Price-to-rent of ${priceToRentRatio.toFixed(1)} suggests the rents are pulling their weight.`,
    );
  }

  // Default safety strings so we always have something.
  if (!strengths.length)
    strengths.push(
      "Deal metrics are in a range where numbers matter less than execution — buy well, manage well, hold long.",
    );
  if (!risks.length)
    risks.push(
      "Verify your rent + expense assumptions against at least three local comps before you commit.",
    );
  if (!nextMoves.length)
    nextMoves.push(
      "Order an inspection, pull property tax records, and confirm rentability with a local property manager.",
    );
  nextMoves.push(
    "Stress-test your assumptions — use the sensitivity analysis below to see what happens if rents soften or rates tick up.",
  );

  // ── Headline + summary ───────────────────────────────────────────
  let headline: string;
  if (dealScore >= 75) {
    headline = "Strong deal on the current numbers";
  } else if (dealScore >= 55) {
    headline = "Solid deal — a few levers to pull";
  } else if (dealScore >= 40) {
    headline = "Marginal deal — needs a reason beyond the math";
  } else {
    headline = "Weak deal on these assumptions";
  }

  const addressBit = inputs.propertyAddress
    ? ` for ${inputs.propertyAddress}`
    : "";
  const summary =
    dealScore >= 60
      ? `The numbers${addressBit} pencil out: cash flow is ${monthlyCashFlow >= 0 ? "positive" : "close to breakeven"}, and returns are in a workable range. Run your rent + expense assumptions past a local manager before pulling the trigger.`
      : `The deal${addressBit} is tight. Small swings in rent, vacancy, or rate can push it to negative cash flow. Make sure you're buying for a reason beyond the headline metrics.`;

  return {
    dealScore: clamp(0, 100, dealScore),
    headline,
    summary,
    strengths: strengths.slice(0, 3),
    risks: risks.slice(0, 3),
    nextMoves: nextMoves.slice(0, 3),
    aiGenerated: false,
  };
}

function clamp(lo: number, hi: number, v: number): number {
  if (!Number.isFinite(v)) return lo;
  return Math.max(lo, Math.min(hi, v));
}
