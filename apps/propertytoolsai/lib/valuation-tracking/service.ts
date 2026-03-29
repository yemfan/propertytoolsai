import { supabaseAdmin } from "@/lib/supabase/admin";
import { buildAccuracySummary, computeErrorMetrics } from "./accuracy";
import type { ValuationSaleAttachInput, ValuationTrackingLogInput } from "./types";

function parseLeadId(leadId: string | null | undefined): number | null {
  if (leadId == null || !String(leadId).trim()) return null;
  const n = Number.parseInt(String(leadId), 10);
  return Number.isFinite(n) ? n : null;
}

export async function logValuationRun(input: ValuationTrackingLogInput) {
  const payload: Record<string, unknown> = {
    lead_id: parseLeadId(input.leadId),
    property_address: input.propertyAddress,
    city: input.city ?? null,
    state: input.state ?? null,
    zip: input.zip ?? null,
    property_type: input.propertyType ?? null,
    beds: input.beds ?? null,
    baths: input.baths ?? null,
    sqft: input.sqft ?? null,
    lot_size: input.lotSize ?? null,
    year_built: input.yearBuilt ?? null,
    condition: input.condition ?? null,
    remodeled_year: input.remodeledYear ?? null,
    api_estimate: input.apiEstimate ?? null,
    comps_estimate: input.compsEstimate ?? null,
    tax_anchor_estimate: input.taxAnchorEstimate ?? null,
    final_estimate: input.finalEstimate,
    low_estimate: input.lowEstimate,
    high_estimate: input.highEstimate,
    confidence_score: input.confidenceScore,
    confidence_label: input.confidenceLabel,
    comparable_count: input.comparableCount,
    weighted_ppsf: input.weightedPpsf ?? null,
    listing_trend_adjustment_pct: input.listingTrendAdjustmentPct,
    condition_adjustment_pct: input.conditionAdjustmentPct,
    range_spread_pct: input.rangeSpreadPct,
    tier_used: input.tierUsed ?? null,
    factors_json: input.factors as unknown[],
    warnings_json: input.warnings,
    valuation_version: input.valuationVersion || "v2",
    source: input.source ?? null,
    updated_at: new Date().toISOString(),
  };

  try {
    const { data, error } = await supabaseAdmin
      .from("valuation_runs")
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data;
  } catch (err: any) {
    const msg = String(err?.message ?? err);
    if (!msg.includes("tax_anchor_estimate")) throw err;

    // Back-compat: until the migration is applied, avoid breaking valuation logging.
    delete payload.tax_anchor_estimate;
    const { data, error } = await supabaseAdmin
      .from("valuation_runs")
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
}

export async function attachActualSaleToValuation(input: ValuationSaleAttachInput) {
  const { data: row, error } = await supabaseAdmin
    .from("valuation_runs")
    .select("id, final_estimate, low_estimate, high_estimate, created_at")
    .eq("id", input.valuationRunId)
    .single();

  if (error || !row) throw new Error("Valuation run not found");

  const metrics = computeErrorMetrics({
    finalEstimate: Number(row.final_estimate),
    lowEstimate: Number(row.low_estimate),
    highEstimate: Number(row.high_estimate),
    actualSalePrice: input.actualSalePrice,
    estimateCreatedAt: row.created_at,
    actualSaleDate: input.actualSaleDate ?? null,
  });

  const { data, error: updateError } = await supabaseAdmin
    .from("valuation_runs")
    .update({
      actual_sale_price: input.actualSalePrice,
      actual_sale_date: input.actualSaleDate ?? new Date().toISOString(),
      actual_days_from_estimate: metrics.actualDaysFromEstimate,
      error_amount: metrics.errorAmount,
      error_pct: metrics.errorPct,
      inside_range: metrics.insideRange,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.valuationRunId)
    .select()
    .single();

  if (updateError) throw updateError;
  return data;
}

export async function getValuationAccuracySummary() {
  const { data, error } = await supabaseAdmin
    .from("valuation_runs")
    .select("confidence_label, error_pct, inside_range")
    .not("actual_sale_price", "is", null);

  if (error) throw error;
  return buildAccuracySummary(data ?? []);
}

export async function getValuationOutliers(limit = 25) {
  const { data, error } = await supabaseAdmin
    .from("valuation_runs")
    .select(
      "id, property_address, city, state, final_estimate, actual_sale_price, error_pct, confidence_label, comparable_count, tier_used, created_at"
    )
    .not("actual_sale_price", "is", null)
    .not("error_pct", "is", null)
    .order("error_pct", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

export async function getValuationCalibrationHints() {
  const { data, error } = await supabaseAdmin
    .from("valuation_runs")
    .select("confidence_label, comparable_count, tier_used, error_pct, inside_range")
    .not("actual_sale_price", "is", null)
    .not("error_pct", "is", null)
    .limit(1000);

  if (error) throw error;
  const rows = data ?? [];

  const tier3or4 = rows.filter((x) => ["tier_3", "tier_4"].includes(String(x.tier_used ?? "")));
  const lowConfidence = rows.filter((x) => x.confidence_label === "low");

  return {
    tier34AvgErrorPct: tier3or4.length
      ? Number(
          (
            (tier3or4.reduce((s, x) => s + Number(x.error_pct ?? 0), 0) / tier3or4.length) *
            100
          ).toFixed(2)
        )
      : 0,
    lowConfidenceInsideRangePct: lowConfidence.length
      ? Number(
          ((lowConfidence.filter((x) => x.inside_range === true).length / lowConfidence.length) * 100).toFixed(
            1
          )
        )
      : 0,
  };
}
