import { clamp } from "./math";

export function calculateConfidenceScore(params: {
  comparableCount: number;
  hasApiEstimate: boolean;
  avgCompDistanceMiles?: number | null;
  apiVsCompsDiffPct?: number | null;
  hasSqft: boolean;
}) {
  let score = 35;

  if (params.comparableCount >= 8) score += 30;
  else if (params.comparableCount >= 5) score += 20;
  else if (params.comparableCount >= 3) score += 10;

  if (params.hasApiEstimate) score += 10;
  if (params.hasSqft) score += 10;

  if (typeof params.avgCompDistanceMiles === "number") {
    if (params.avgCompDistanceMiles <= 0.5) score += 10;
    else if (params.avgCompDistanceMiles > 1.5) score -= 8;
  }

  if (typeof params.apiVsCompsDiffPct === "number") {
    if (params.apiVsCompsDiffPct <= 0.08) score += 10;
    else if (params.apiVsCompsDiffPct >= 0.2) score -= 15;
  }

  score = clamp(score, 10, 95);

  return {
    score,
    label: score >= 75 ? ("high" as const) : score >= 50 ? ("medium" as const) : ("low" as const),
  };
}

export function getRangeSpreadPct(confidenceScore: number, comparableCount: number) {
  let spread = 0.12;
  if (confidenceScore >= 80) spread = 0.06;
  else if (confidenceScore >= 65) spread = 0.08;
  else if (confidenceScore >= 50) spread = 0.1;
  else spread = 0.14;

  if (comparableCount < 3) spread += 0.03;
  return spread;
}
