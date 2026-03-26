import type { ValuationTrainingRow } from "./types";

function toNum(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function pctDiff(a?: number | null, b?: number | null) {
  if (a == null || b == null) return null;
  const denom = (Math.abs(a) + Math.abs(b)) / 2;
  if (!denom) return null;
  return Math.abs(a - b) / denom;
}

function monthsBetween(a?: string | null, b?: string | null) {
  if (!a || !b) return null;
  const diff = (new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24 * 30);
  return Number.isFinite(diff) ? Number(diff.toFixed(2)) : null;
}

export function enrichTrainingRows(rows: ValuationTrainingRow[]): ValuationTrainingRow[] {
  return rows.map((row) => {
    const api = toNum(row.api_estimate);
    const comps = toNum(row.comps_estimate);
    const tax = toNum(row.tax_anchor_estimate);

    const api_vs_comps_diff_pct = pctDiff(api, comps);
    const tax_vs_comps_diff_pct = pctDiff(tax, comps);
    const tax_vs_api_diff_pct = pctDiff(tax, api);
    const months_from_estimate_to_sale = monthsBetween(row.created_at, row.actual_sale_date ?? null);

    return {
      ...row,
      api_vs_comps_diff_pct,
      tax_vs_comps_diff_pct,
      tax_vs_api_diff_pct,
      months_since_last_sale: null,
      months_from_estimate_to_sale,
    };
  });
}
