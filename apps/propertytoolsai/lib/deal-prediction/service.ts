import { supabaseAdmin } from "@/lib/supabase/admin";
import { buildLeadPredictionFeatures } from "./features";
import { predictLeadClose } from "./rules";
import type { LeadPredictionResult } from "./types";

const ACTIVE_LEAD_STATUSES = [
  "new",
  "assigned",
  "contacted",
  "qualified",
  "nurturing",
  "warm",
  "open",
];

export async function updateLeadPrediction(leadId: string): Promise<LeadPredictionResult> {
  const features = await buildLeadPredictionFeatures(leadId);
  const prediction = predictLeadClose(features);

  await supabaseAdmin
    .from("leads")
    .update({
      close_probability: prediction.closeProbability,
      predicted_deal_value: prediction.predictedDealValue,
      predicted_close_window: prediction.predictedCloseWindow,
      prediction_factors_json: prediction.factors,
      prediction_updated_at: new Date().toISOString(),
    })
    .eq("id", leadId);

  return prediction;
}

export async function refreshPredictionsForActiveLeads(limit = 500) {
  const { data: leads, error } = await supabaseAdmin
    .from("leads")
    .select("id")
    .in("lead_status", ACTIVE_LEAD_STATUSES)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  const results: Array<{ leadId: string; success: boolean; error?: string }> = [];
  for (const lead of leads ?? []) {
    try {
      await updateLeadPrediction(String(lead.id));
      results.push({ leadId: String(lead.id), success: true });
    } catch (err) {
      results.push({
        leadId: String(lead.id),
        success: false,
        error: err instanceof Error ? err.message : "Prediction failed",
      });
    }
  }

  return results;
}

export async function getPredictedPipelineSummary() {
  const { data, error } = await supabaseAdmin
    .from("leads")
    .select("close_probability, predicted_deal_value, predicted_close_window")
    .gt("close_probability", 0);

  if (error) throw error;
  const rows = data ?? [];

  const weightedPipeline = rows.reduce(
    (sum: number, row: { predicted_deal_value?: number | null; close_probability?: number | null }) =>
      sum + (Number(row.predicted_deal_value ?? 0) * Number(row.close_probability ?? 0)) / 100,
    0
  );

  const highConfidence = rows.filter((x: { close_probability?: number | null }) => Number(x.close_probability ?? 0) >= 70);
  const closeSoon = rows.filter(
    (x: { predicted_close_window?: string | null }) => x.predicted_close_window === "0-7 days"
  );

  return {
    weightedPipeline: Math.round(weightedPipeline),
    highConfidenceLeadCount: highConfidence.length,
    closeSoonLeadCount: closeSoon.length,
    avgCloseProbability:
      rows.length > 0
        ? Number(
            (
              rows.reduce(
                (sum: number, row: { close_probability?: number | null }) =>
                  sum + Number(row.close_probability ?? 0),
                0
              ) / rows.length
            ).toFixed(1)
          )
        : 0,
  };
}
