import type { DealPredictionLabel, DealPredictionResult } from "@leadsmart/shared";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { type DealPredictionInput, computeDealPrediction, DEAL_PREDICTION_WINDOW_DAYS } from "./computeScore";

const LEAD_SELECT_FOR_PREDICTION = [
  "id",
  "agent_id",
  "merged_into_lead_id",
  "engagement_score",
  "last_activity_at",
  "last_contacted_at",
  "property_value",
  "estimated_home_value",
  "home_purchase_date",
  "source",
  "rating",
  "intent",
  "timeframe",
  "nurture_score",
  "created_at",
  "prediction_score",
  "prediction_label",
  "prediction_factors",
  "prediction_computed_at",
].join(",");

const DAY_MS = 86_400_000;

function numOrNull(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

async function countSince(
  table: "sms_messages" | "email_messages",
  leadId: string,
  sinceIso: string,
  direction: "inbound" | "outbound",
): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("contact_id", leadId)
    .eq("direction", direction)
    .gte("created_at", sinceIso);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function countLeadEventsSince(leadId: string, sinceIso: string): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from("contact_events")
    .select("id", { count: "exact", head: true })
    .eq("contact_id", leadId)
    .gte("created_at", sinceIso);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function latestAiLeadScore(leadId: string): Promise<number | null> {
  const { data, error } = await supabaseAdmin
    .from("contact_scores")
    .select("score")
    .eq("contact_id", leadId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return numOrNull((data as { score?: unknown }).score);
}

export async function buildDealPredictionInput(leadId: string): Promise<DealPredictionInput | null> {
  const { data: row, error } = await supabaseAdmin
    .from("contacts")
    .select(LEAD_SELECT_FOR_PREDICTION)
    .eq("id", leadId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!row) return null;
  const r = row as unknown as Record<string, unknown>;
  if (r.merged_into_lead_id != null) return null;

  const since = new Date(Date.now() - DEAL_PREDICTION_WINDOW_DAYS * DAY_MS).toISOString();

  const [smsIn, smsOut, emailIn, emailOut, events, aiLeadScore] = await Promise.all([
    countSince("sms_messages", leadId, since, "inbound"),
    countSince("sms_messages", leadId, since, "outbound"),
    countSince("email_messages", leadId, since, "inbound"),
    countSince("email_messages", leadId, since, "outbound"),
    countLeadEventsSince(leadId, since),
    latestAiLeadScore(leadId),
  ]);

  return {
    engagementScore: Number(r.engagement_score ?? 0),
    smsInbound90d: smsIn,
    smsOutbound90d: smsOut,
    emailInbound90d: emailIn,
    emailOutbound90d: emailOut,
    leadEvents90d: events,
    lastActivityAt: (r.last_activity_at as string) ?? null,
    lastContactedAt: (r.last_contacted_at as string) ?? null,
    propertyValue: numOrNull(r.property_value),
    estimatedHomeValue: numOrNull(r.estimated_home_value),
    homePurchaseDate: r.home_purchase_date != null ? String(r.home_purchase_date) : null,
    source: r.source != null ? String(r.source) : null,
    rating: r.rating != null ? String(r.rating) : null,
    intent: r.intent != null ? String(r.intent) : null,
    timeframe: r.timeframe != null ? String(r.timeframe) : null,
    nurtureScore: numOrNull(r.nurture_score),
    aiLeadScore,
    createdAt: (r.created_at as string) ?? null,
  };
}

export async function persistDealPrediction(leadId: string, result: DealPredictionResult): Promise<void> {
  const { error } = await supabaseAdmin
    .from("contacts")
    .update({
      prediction_score: result.score,
      prediction_label: result.label,
      prediction_factors: result.factors,
      prediction_computed_at: new Date().toISOString(),
    })
    .eq("id", leadId);

  if (error) throw new Error(error.message);
}

/** Load inputs, compute, and persist. Returns null if lead missing or merged away. */
export async function recomputeDealPredictionForLead(leadId: string): Promise<DealPredictionResult | null> {
  const input = await buildDealPredictionInput(leadId);
  if (!input) return null;
  const result = computeDealPrediction(input);
  await persistDealPrediction(leadId, result);
  return result;
}

export async function recomputeDealPredictionsForAgent(
  agentId: string,
  limit = 300,
): Promise<{ processed: number; errors: number }> {
  const cap = clampLimit(limit);
  const { data, error } = await supabaseAdmin
    .from("contacts")
    .select("id")
    .eq("agent_id", agentId as never)
    .is("merged_into_lead_id", null)
    .order("updated_at", { ascending: false })
    .limit(cap);

  if (error) throw new Error(error.message);

  let processed = 0;
  let errors = 0;
  for (const row of data ?? []) {
    const id = String((row as { id: unknown }).id);
    try {
      await recomputeDealPredictionForLead(id);
      processed += 1;
    } catch {
      errors += 1;
    }
  }
  return { processed, errors };
}

function clampLimit(n: number): number {
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(Math.floor(n), 2000);
}

export type HighProbabilityLeadRow = {
  id: string;
  name: string | null;
  prediction_score: number;
  prediction_label: string;
  prediction_computed_at: string | null;
  last_activity_at: string | null;
  source: string | null;
};

/**
 * Leads most likely to transact in the next few months (already-computed scores).
 */
export async function listHighProbabilityLeads(params: {
  agentId: string;
  minScore?: number;
  label?: DealPredictionLabel;
  limit?: number;
}): Promise<HighProbabilityLeadRow[]> {
  const minScore = params.minScore != null && Number.isFinite(params.minScore) ? params.minScore : 70;
  const limit = params.limit != null && Number.isFinite(params.limit) ? Math.min(Math.max(params.limit, 1), 200) : 50;

  let q = supabaseAdmin
    .from("contacts")
    .select("id,name,prediction_score,prediction_label,prediction_computed_at,last_activity_at,source")
    .eq("agent_id", params.agentId as never)
    .is("merged_into_lead_id", null)
    .gte("prediction_score", minScore)
    .not("prediction_score", "is", null)
    .order("prediction_score", { ascending: false })
    .limit(limit);

  if (params.label) {
    q = q.eq("prediction_label", params.label);
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  return (data ?? []).map((r) => {
    const row = r as Record<string, unknown>;
    return {
      id: String(row.id ?? ""),
      name: row.name != null ? String(row.name) : null,
      prediction_score: Number(row.prediction_score ?? 0),
      prediction_label: String(row.prediction_label ?? ""),
      prediction_computed_at: row.prediction_computed_at != null ? String(row.prediction_computed_at) : null,
      last_activity_at: row.last_activity_at != null ? String(row.last_activity_at) : null,
      source: row.source != null ? String(row.source) : null,
    };
  });
}
