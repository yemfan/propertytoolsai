import { supabaseAdmin } from "@/lib/supabase/admin";
import { summarizeErrorRows, tuneWeightsFromPerformance } from "./math";
import { classifyValuationScenario, defaultCalibrationProfile } from "./scenarios";
import type { CalibrationCandidate, CalibrationProfile, CalibrationScenarioKey } from "./types";

async function getHistoricalRowsForCalibration() {
  const { data, error } = await supabaseAdmin
    .from("valuation_runs")
    .select(
      "id, comparable_count, confidence_label, error_pct, inside_range, tier_used, api_estimate, comps_estimate"
    )
    .not("actual_sale_price", "is", null)
    .not("error_pct", "is", null)
    .limit(5000);

  if (error) throw error;
  return data ?? [];
}

function profileRowToTunable(row: Record<string, unknown>) {
  return {
    compsWeight: Number(row.comps_weight),
    apiWeight: Number(row.api_weight),
    trendWeight: Number(row.trend_weight),
    taxWeight: Number(row.tax_weight),
    conditionCapPct: Number(row.condition_cap_pct),
    confidencePenaltyPct: Number(row.confidence_penalty_pct),
  };
}

export async function buildCalibrationCandidates(): Promise<CalibrationCandidate[]> {
  const rows = await getHistoricalRowsForCalibration();
  const scenarios: CalibrationScenarioKey[] = [
    "strong_comps",
    "medium_comps",
    "weak_comps",
    "tax_fallback",
    "api_only",
  ];

  const { data: existingProfiles, error: profileErr } = await supabaseAdmin
    .from("valuation_calibration_profiles")
    .select("*");
  if (profileErr) throw profileErr;

  const byScenario = new Map(
    (existingProfiles ?? []).map((r: Record<string, unknown>) => [String(r.scenario_key), r])
  );

  const candidates: CalibrationCandidate[] = [];

  for (const scenarioKey of scenarios) {
    const scenarioRows = rows.filter((row: Record<string, unknown>) => {
      return classifyValuationScenario({
        comparable_count: Number(row.comparable_count || 0),
        api_estimate: row.api_estimate == null ? null : Number(row.api_estimate),
        tier_used: row.tier_used != null ? String(row.tier_used) : null,
      }) === scenarioKey;
    });

    const stats = summarizeErrorRows(scenarioRows);
    const existing = byScenario.get(scenarioKey);
    const current = existing ? profileRowToTunable(existing) : defaultCalibrationProfile(scenarioKey);
    const tuned = tuneWeightsFromPerformance(current, stats, scenarioKey);

    candidates.push({
      scenarioKey,
      sampleSize: stats.sampleSize,
      medianErrorPct: Number((stats.medianErrorPct * 100).toFixed(2)),
      insideRangePct: Number((stats.insideRangePct * 100).toFixed(1)),
      suggested: tuned.next,
      notes: tuned.notes,
    });
  }

  return candidates;
}

export async function applyCalibrationCandidates(candidates: CalibrationCandidate[]) {
  const applied: CalibrationProfile[] = [];

  for (const candidate of candidates) {
    const { data: existing } = await supabaseAdmin
      .from("valuation_calibration_profiles")
      .select("version")
      .eq("scenario_key", candidate.scenarioKey)
      .maybeSingle();

    const version = Number(existing?.version || 0) + 1;
    const notesJoined = candidate.notes.join(" ");
    const now = new Date().toISOString();

    const profilePayload = {
      scenario_key: candidate.scenarioKey,
      comps_weight: candidate.suggested.compsWeight,
      api_weight: candidate.suggested.apiWeight,
      trend_weight: candidate.suggested.trendWeight,
      tax_weight: candidate.suggested.taxWeight,
      condition_cap_pct: candidate.suggested.conditionCapPct,
      confidence_penalty_pct: candidate.suggested.confidencePenaltyPct,
      sample_size: candidate.sampleSize,
      median_error_pct: candidate.medianErrorPct,
      inside_range_pct: candidate.insideRangePct,
      version,
      notes: notesJoined || null,
      updated_at: now,
    };

    const { error: upsertErr } = await supabaseAdmin
      .from("valuation_calibration_profiles")
      .upsert(profilePayload, { onConflict: "scenario_key" });
    if (upsertErr) throw upsertErr;

    const { error: histErr } = await supabaseAdmin.from("valuation_calibration_history").insert({
      scenario_key: candidate.scenarioKey,
      comps_weight: candidate.suggested.compsWeight,
      api_weight: candidate.suggested.apiWeight,
      trend_weight: candidate.suggested.trendWeight,
      tax_weight: candidate.suggested.taxWeight,
      condition_cap_pct: candidate.suggested.conditionCapPct,
      confidence_penalty_pct: candidate.suggested.confidencePenaltyPct,
      sample_size: candidate.sampleSize,
      median_error_pct: candidate.medianErrorPct,
      inside_range_pct: candidate.insideRangePct,
      version,
      notes: notesJoined || null,
      created_at: now,
    });
    if (histErr) throw histErr;

    applied.push({
      scenarioKey: candidate.scenarioKey,
      compsWeight: candidate.suggested.compsWeight,
      apiWeight: candidate.suggested.apiWeight,
      trendWeight: candidate.suggested.trendWeight,
      taxWeight: candidate.suggested.taxWeight,
      conditionCapPct: candidate.suggested.conditionCapPct,
      confidencePenaltyPct: candidate.suggested.confidencePenaltyPct,
      sampleSize: candidate.sampleSize,
      medianErrorPct: candidate.medianErrorPct,
      insideRangePct: candidate.insideRangePct,
      version,
      notes: notesJoined || null,
    });
  }

  return applied;
}

export async function getCalibrationProfiles() {
  const { data, error } = await supabaseAdmin
    .from("valuation_calibration_profiles")
    .select("*")
    .order("scenario_key", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row: Record<string, unknown>) => ({
    scenarioKey: row.scenario_key as CalibrationScenarioKey,
    compsWeight: Number(row.comps_weight),
    apiWeight: Number(row.api_weight),
    trendWeight: Number(row.trend_weight),
    taxWeight: Number(row.tax_weight),
    conditionCapPct: Number(row.condition_cap_pct),
    confidencePenaltyPct: Number(row.confidence_penalty_pct),
    sampleSize: Number(row.sample_size),
    medianErrorPct: Number(row.median_error_pct),
    insideRangePct: Number(row.inside_range_pct),
    version: Number(row.version),
    notes: row.notes != null ? String(row.notes) : null,
  })) as CalibrationProfile[];
}

export async function runAutoCalibration() {
  const candidates = await buildCalibrationCandidates();
  const applied = await applyCalibrationCandidates(candidates);
  return { candidates, applied };
}
