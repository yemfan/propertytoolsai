import type { ValuationAccuracyRow, ValuationAccuracySummary } from "./types";

function avg(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, x) => sum + x, 0) / values.length;
}

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

export function computeErrorMetrics(params: {
  finalEstimate: number;
  lowEstimate: number;
  highEstimate: number;
  actualSalePrice: number;
  estimateCreatedAt: string;
  actualSaleDate?: string | null;
}) {
  const errorAmount = params.actualSalePrice - params.finalEstimate;
  const errorPct = params.actualSalePrice
    ? Math.abs(errorAmount) / params.actualSalePrice
    : 0;

  const insideRange =
    params.actualSalePrice >= params.lowEstimate && params.actualSalePrice <= params.highEstimate;

  const actualDaysFromEstimate = params.actualSaleDate
    ? Math.round(
        (new Date(params.actualSaleDate).getTime() - new Date(params.estimateCreatedAt).getTime()) /
          (1000 * 60 * 60 * 24)
      )
    : null;

  return {
    errorAmount,
    errorPct,
    insideRange,
    actualDaysFromEstimate,
  };
}

export function buildAccuracySummary(rows: ValuationAccuracyRow[]): ValuationAccuracySummary {
  const valid = rows.filter((x) => typeof x.error_pct === "number" && x.error_pct != null);
  const errorPcts = valid.map((x) => Number(x.error_pct ?? 0));
  const high = valid.filter((x) => x.confidence_label === "high").map((x) => Number(x.error_pct ?? 0));
  const medium = valid.filter((x) => x.confidence_label === "medium").map((x) => Number(x.error_pct ?? 0));
  const low = valid.filter((x) => x.confidence_label === "low").map((x) => Number(x.error_pct ?? 0));

  return {
    totalTrackedSales: valid.length,
    medianErrorPct: Number((median(errorPcts) * 100).toFixed(2)),
    avgErrorPct: Number((avg(errorPcts) * 100).toFixed(2)),
    withinRangePct: valid.length
      ? Number(((valid.filter((x) => x.inside_range === true).length / valid.length) * 100).toFixed(1))
      : 0,
    highConfidenceMedianErrorPct: Number((median(high) * 100).toFixed(2)),
    mediumConfidenceMedianErrorPct: Number((median(medium) * 100).toFixed(2)),
    lowConfidenceMedianErrorPct: Number((median(low) * 100).toFixed(2)),
  };
}
