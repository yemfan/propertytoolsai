/**
 * Tax anchor for ML / hybrid stack:
 *   tax_anchor_estimate = lastSalePrice * (currentAssessedValue / assessedValueAtSale)
 *
 * Uses Rentcast property record fields: lastSalePrice, lastSaleDate, taxAssessments{year -> value}.
 */

type TaxAssessmentEntry = { year?: number; value?: number; land?: number; improvements?: number };

function parseTaxAssessments(raw: unknown): Record<string, TaxAssessmentEntry> | null {
  if (!raw || typeof raw !== "object") return null;
  return raw as Record<string, TaxAssessmentEntry>;
}

/** Latest calendar year in taxAssessments with a positive total value. */
export function latestAssessmentValue(taxAssessments: Record<string, TaxAssessmentEntry>): number | null {
  let bestYear = -Infinity;
  let best: number | null = null;

  for (const key of Object.keys(taxAssessments)) {
    const entry = taxAssessments[key];
    const y = typeof entry?.year === "number" ? entry.year : Number.parseInt(key, 10);
    const v = entry?.value != null ? Number(entry.value) : NaN;
    if (!Number.isFinite(y) || !Number.isFinite(v) || v <= 0) continue;
    if (y > bestYear) {
      bestYear = y;
      best = v;
    }
  }
  return best;
}

/**
 * Assessment total value near the last sale (same year, or adjacent years if county lags).
 */
export function assessmentValueNearSaleYear(
  taxAssessments: Record<string, TaxAssessmentEntry>,
  saleYear: number
): number | null {
  const tryYears = [saleYear, saleYear - 1, saleYear - 2, saleYear + 1];
  for (const y of tryYears) {
    const key = String(y);
    const entry = taxAssessments[key];
    const v = entry?.value != null ? Number(entry.value) : NaN;
    if (Number.isFinite(v) && v > 0) return v;
  }
  return null;
}

export function computeTaxAnchorEstimate(propertyRecord: Record<string, unknown>): number | null {
  const lastSalePrice = Number(propertyRecord.lastSalePrice ?? 0);
  if (!Number.isFinite(lastSalePrice) || lastSalePrice <= 0) return null;

  const taxAssessments = parseTaxAssessments(propertyRecord.taxAssessments);
  if (!taxAssessments || Object.keys(taxAssessments).length === 0) return null;

  const currentAssessedValue = latestAssessmentValue(taxAssessments);
  if (currentAssessedValue == null || currentAssessedValue <= 0) return null;

  const lastSaleRaw = propertyRecord.lastSaleDate;
  const saleDate = lastSaleRaw ? new Date(String(lastSaleRaw)) : null;
  const saleYear =
    saleDate && !Number.isNaN(saleDate.getTime()) ? saleDate.getFullYear() : null;

  const assessedAtSale =
    saleYear != null ? assessmentValueNearSaleYear(taxAssessments, saleYear) : null;

  if (assessedAtSale == null || assessedAtSale <= 0) return null;

  const anchor = lastSalePrice * (currentAssessedValue / assessedAtSale);
  return Number.isFinite(anchor) && anchor > 0 ? anchor : null;
}
