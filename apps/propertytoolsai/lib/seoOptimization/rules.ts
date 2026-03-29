import type { OptimizationAction } from "./types";

export type SeoRulesConfig = {
  /** CTR below this triggers title/meta focus (when not already full rewrite). Default ~2.5%. */
  lowCtrThreshold: number;
  /** Average position above this → treat as "low ranking" (full rewrite). Default 30. */
  lowRankPosition: number;
  /** Inclusive range for "mid" ranking → improve body content. Default 8–30. */
  midRankMin: number;
  midRankMax: number;
};

function envNum(name: string, fallback: number): number {
  const v = process.env[name]?.trim();
  if (!v) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function getDefaultSeoRules(): SeoRulesConfig {
  return {
    lowCtrThreshold: envNum("SEO_OPT_LOW_CTR", 0.025),
    lowRankPosition: envNum("SEO_OPT_LOW_RANK_POS", 30),
    midRankMin: envNum("SEO_OPT_MID_RANK_MIN", 8),
    midRankMax: envNum("SEO_OPT_MID_RANK_MAX", 30),
  };
}

export type ClassifyInput = {
  impressions: number;
  ctr: number;
  positionAvg: number | null;
};

/**
 * Priority: low ranking (rewrite) → low CTR (title/meta) → mid ranking (body) → FAQ expansion.
 * - Low ranking (position > threshold) → rewrite_full
 * - Low CTR → improve_title_meta (snippet / CTR)
 * - Mid ranking → improve_content
 * - Strong traffic, healthy CTR → add_faqs
 */
export function classifyOptimizationAction(
  input: ClassifyInput,
  rules: SeoRulesConfig = getDefaultSeoRules()
): OptimizationAction {
  const { impressions, ctr, positionAvg } = input;
  if (impressions < 1) return "none";

  if (positionAvg != null && positionAvg > rules.lowRankPosition) {
    return "rewrite_full";
  }

  if (ctr < rules.lowCtrThreshold) {
    return "improve_title_meta";
  }

  if (
    positionAvg != null &&
    positionAvg >= rules.midRankMin &&
    positionAvg <= rules.midRankMax
  ) {
    return "improve_content";
  }

  if (impressions >= 200 && ctr >= rules.lowCtrThreshold) {
    return "add_faqs";
  }

  return "none";
}
