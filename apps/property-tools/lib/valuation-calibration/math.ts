function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function summarizeErrorRows(rows: { error_pct?: unknown; inside_range?: unknown }[]) {
  const errorPcts = rows
    .map((x) => Number(x.error_pct || 0))
    .filter((x) => Number.isFinite(x));
  const insideRangePct = rows.length
    ? rows.filter((x) => Boolean(x.inside_range)).length / rows.length
    : 0;

  return {
    sampleSize: rows.length,
    medianErrorPct: median(errorPcts),
    insideRangePct,
  };
}

export function normalizeWeights(weights: {
  compsWeight: number;
  apiWeight: number;
  trendWeight: number;
  taxWeight: number;
}) {
  const total = weights.compsWeight + weights.apiWeight + weights.trendWeight + weights.taxWeight;
  if (total <= 0) return weights;

  return {
    compsWeight: weights.compsWeight / total,
    apiWeight: weights.apiWeight / total,
    trendWeight: weights.trendWeight / total,
    taxWeight: weights.taxWeight / total,
  };
}

export function tuneWeightsFromPerformance(
  current: {
    compsWeight: number;
    apiWeight: number;
    trendWeight: number;
    taxWeight: number;
    conditionCapPct: number;
    confidencePenaltyPct: number;
  },
  stats: {
    medianErrorPct: number;
    insideRangePct: number;
    sampleSize: number;
  },
  scenarioKey: string
) {
  let next = { ...current };
  const notes: string[] = [];

  if (stats.sampleSize < 20) {
    notes.push("Sample size too small for strong automatic tuning; defaults preserved.");
    return { next, notes };
  }

  if (stats.medianErrorPct > 0.12) {
    next.conditionCapPct = clamp(current.conditionCapPct - 0.01, 0.04, 0.1);
    next.confidencePenaltyPct = clamp(current.confidencePenaltyPct + 0.01, 0, 0.12);
    notes.push("Median error is elevated; tightening condition adjustment cap and increasing confidence penalty.");
  }

  if (stats.insideRangePct < 0.55) {
    if (scenarioKey === "weak_comps" || scenarioKey === "tax_fallback" || scenarioKey === "api_only") {
      next.taxWeight = clamp(current.taxWeight + 0.03, 0, 0.45);
      next.apiWeight = clamp(current.apiWeight - 0.02, 0, 0.75);
      notes.push("Inside-range performance is weak; modestly increasing fallback stabilization.");
    } else {
      next.trendWeight = clamp(current.trendWeight + 0.02, 0.05, 0.2);
      next.apiWeight = clamp(current.apiWeight - 0.02, 0.1, 0.6);
      notes.push("Inside-range performance is weak; slightly increasing trend smoothing.");
    }
  }

  if (scenarioKey === "strong_comps" && stats.medianErrorPct < 0.06 && stats.insideRangePct > 0.72) {
    next.compsWeight = clamp(current.compsWeight + 0.03, 0.5, 0.75);
    next.apiWeight = clamp(current.apiWeight - 0.03, 0.15, 0.35);
    notes.push("Strong comps scenario is performing well; slightly increasing comp weight.");
  }

  if (scenarioKey === "tax_fallback" && stats.medianErrorPct > 0.15) {
    next.taxWeight = clamp(current.taxWeight - 0.05, 0.15, 0.4);
    next.trendWeight = clamp(current.trendWeight + 0.03, 0.1, 0.25);
    notes.push("Tax fallback scenario is underperforming; reducing tax reliance modestly.");
  }

  const normalized = normalizeWeights({
    compsWeight: next.compsWeight,
    apiWeight: next.apiWeight,
    trendWeight: next.trendWeight,
    taxWeight: next.taxWeight,
  });

  next = {
    ...next,
    ...normalized,
  };

  return { next, notes };
}
