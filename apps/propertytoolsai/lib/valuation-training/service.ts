import { supabaseAdmin } from "@/lib/supabase/admin";
import { enrichTrainingRows } from "@/lib/valuation-training/normalize";
import type { ValuationTrainingExportFilters, ValuationTrainingRow } from "@/lib/valuation-training/types";

export type TrainingDatasetFilters = ValuationTrainingExportFilters & {
  /** Max rows returned (workflow / bulk export). Default 20000, max 100000. */
  limit?: number;
};

export async function recordTrainingExport(params: {
  exportName: string;
  rowCount: number;
  filters: ValuationTrainingExportFilters;
  schemaVersion: string;
  fileFormat: "csv" | "json";
  createdBy: string;
}) {
  const { error } = await supabaseAdmin.from("valuation_training_exports").insert({
    export_name: params.exportName,
    row_count: params.rowCount,
    filters_json: params.filters as unknown as Record<string, unknown>,
    schema_version: params.schemaVersion,
    file_format: params.fileFormat,
    created_by: params.createdBy,
  });
  if (error) throw error;
}

function applyTrainingQueryFilters(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: any,
  filters: ValuationTrainingExportFilters
) {
  if (filters.minSaleDate?.trim()) {
    query = query.gte("actual_sale_date", filters.minSaleDate.trim());
  }
  if (filters.maxSaleDate?.trim()) {
    query = query.lte("actual_sale_date", filters.maxSaleDate.trim());
  }
  if (filters.cities?.length) {
    query = query.in("city", filters.cities);
  }
  if (filters.states?.length) {
    query = query.in("state", filters.states);
  }
  if (filters.propertyTypes?.length) {
    query = query.in("property_type", filters.propertyTypes);
  }
  if (filters.confidenceLabels?.length) {
    query = query.in("confidence_label", filters.confidenceLabels);
  }
  if (typeof filters.minComparableCount === "number" && Number.isFinite(filters.minComparableCount)) {
    query = query.gte("comparable_count", filters.minComparableCount);
  }
  if (typeof filters.maxErrorPct === "number" && Number.isFinite(filters.maxErrorPct)) {
    query = query.lte("error_pct", filters.maxErrorPct);
  }
  if (filters.requireSqft) {
    query = query.not("sqft", "is", null).gt("sqft", 0);
  }
  if (filters.requireApiEstimate) {
    query = query.not("api_estimate", "is", null);
  }
  if (filters.requireCompsEstimate) {
    query = query.not("comps_estimate", "is", null);
  }
  return query;
}

export async function getTrainingDataset(filters: TrainingDatasetFilters = {}): Promise<ValuationTrainingRow[]> {
  const limit = Math.min(Math.max(filters.limit ?? 20000, 1), 100000);

  let query = supabaseAdmin.from("valuation_training_rows").select("*");
  query = applyTrainingQueryFilters(query, filters);
  const { data, error } = await query.limit(limit);

  if (error) throw error;
  const rows = (data ?? []) as unknown as ValuationTrainingRow[];
  return enrichTrainingRows(rows);
}

export function parseTrainingFiltersFromSearchParams(
  searchParams: URLSearchParams
): ValuationTrainingExportFilters {
  const cities = searchParams.get("cities");
  const states = searchParams.get("states");
  const propertyTypes = searchParams.get("propertyTypes");
  const confidenceLabels = searchParams.get("confidenceLabels");

  return {
    minSaleDate: searchParams.get("minSaleDate") ?? undefined,
    maxSaleDate: searchParams.get("maxSaleDate") ?? undefined,
    minComparableCount: searchParams.get("minComparableCount")
      ? Number(searchParams.get("minComparableCount"))
      : undefined,
    maxErrorPct: searchParams.get("maxErrorPct") ? Number(searchParams.get("maxErrorPct")) : undefined,
    requireSqft: searchParams.get("requireSqft") === "true",
    requireApiEstimate: searchParams.get("requireApiEstimate") === "true",
    requireCompsEstimate: searchParams.get("requireCompsEstimate") === "true",
    cities: cities ? cities.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
    states: states ? states.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
    propertyTypes: propertyTypes ? propertyTypes.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
    confidenceLabels: confidenceLabels
      ? (confidenceLabels.split(",").map((s) => s.trim()).filter(Boolean) as Array<"high" | "medium" | "low">)
      : undefined,
  };
}

export async function getTrainingDatasetSummary(filters: TrainingDatasetFilters) {
  let countQuery = supabaseAdmin
    .from("valuation_training_rows")
    .select("*", { count: "exact", head: true });
  countQuery = applyTrainingQueryFilters(countQuery, filters);
  const { count: rowCount, error: countErr } = await countQuery;
  if (countErr) throw countErr;

  const sampleLimit = 25000;
  let sampleQuery = supabaseAdmin
    .from("valuation_training_rows")
    .select("city,state,property_type,api_estimate,comps_estimate,sqft");
  sampleQuery = applyTrainingQueryFilters(sampleQuery, filters);
  const { data: sample, error: sampleErr } = await sampleQuery.limit(sampleLimit);
  if (sampleErr) throw sampleErr;

  const rows = sample ?? [];
  const cities = new Set<string>();
  const states = new Set<string>();
  const ptypes = new Set<string>();
  let withApi = 0;
  let withComps = 0;
  let withSqft = 0;

  for (const r of rows) {
    const row = r as Record<string, unknown>;
    if (row.city != null && String(row.city).trim()) cities.add(String(row.city));
    if (row.state != null && String(row.state).trim()) states.add(String(row.state));
    if (row.property_type != null && String(row.property_type).trim()) ptypes.add(String(row.property_type));
    const api = row.api_estimate;
    if (api != null && Number(api) > 0) withApi++;
    const comps = row.comps_estimate;
    if (comps != null && Number(comps) > 0) withComps++;
    const sq = row.sqft;
    if (sq != null && Number(sq) > 0) withSqft++;
  }

  const n = rows.length || 1;

  return {
    rowCount: rowCount ?? 0,
    cityCount: cities.size,
    stateCount: states.size,
    propertyTypeCount: ptypes.size,
    withApiEstimatePct: Math.round((withApi / n) * 1000) / 10,
    withCompsEstimatePct: Math.round((withComps / n) * 1000) / 10,
    withSqftPct: Math.round((withSqft / n) * 1000) / 10,
  };
}
