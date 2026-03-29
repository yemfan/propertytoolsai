import { supabaseAdmin } from "@/lib/supabase/admin";
import { calculateLeadScore, getLeadTemperature } from "./rules";
import type { UnifiedActivityEvent } from "./rules";
import type { UpdateLeadScoreResult } from "./types";

function maxIsoTimestamps(...values: (string | null | undefined)[]): string | null {
  let best: number | null = null;
  let bestIso: string | null = null;
  for (const v of values) {
    if (!v) continue;
    const t = new Date(v).getTime();
    if (!Number.isFinite(t)) continue;
    if (best == null || t > best) {
      best = t;
      bestIso = new Date(t).toISOString();
    }
  }
  return bestIso;
}

/**
 * Recomputes `lead_score`, `lead_temperature`, and `last_activity_at` for a lead.
 * Safe to call from webhooks / after activity (fire-and-forget ok).
 */
export async function updateLeadScore(leadId: string): Promise<UpdateLeadScoreResult> {
  const { data: lead, error: leadErr } = await supabaseAdmin
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .single();

  if (leadErr || !lead) {
    throw new Error(`Lead not found: ${leadId}`);
  }

  const [{ data: crm }, engRes, { count: inboundCount }, { data: latestConvo }] = await Promise.all([
    supabaseAdmin
      .from("lead_activity_events")
      .select("event_type, created_at")
      .eq("lead_id", leadId),
    supabaseAdmin.from("lead_events").select("event_type, created_at").eq("lead_id", leadId),
    supabaseAdmin
      .from("lead_conversations")
      .select("id", { count: "exact", head: true })
      .eq("lead_id", leadId)
      .eq("direction", "inbound"),
    supabaseAdmin
      .from("lead_conversations")
      .select("created_at")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const engagement = engRes.error ? [] : engRes.data ?? [];
  if (engRes.error) {
    console.warn("[updateLeadScore] lead_events skipped:", engRes.error.message);
  }

  const activity: UnifiedActivityEvent[] = [
    ...(crm ?? []).map((r) => ({
      event_type: r.event_type as string,
      created_at: r.created_at as string,
    })),
    ...engagement.map((r) => ({
      event_type: r.event_type as string,
      created_at: r.created_at as string,
    })),
  ];

  const lastActivityAt = maxIsoTimestamps(
    ...(activity.map((a) => a.created_at) as string[]),
    latestConvo?.created_at as string | undefined,
    (lead as { updated_at?: string }).updated_at,
    (lead as { created_at?: string }).created_at
  );

  const leadForScore = {
    source: lead.source as string | null,
    intent: lead.intent as string | null,
    price: typeof lead.price === "number" ? lead.price : null,
    last_activity_at: lastActivityAt,
  };

  const score = calculateLeadScore(leadForScore, activity, inboundCount ?? 0);
  const temperature = getLeadTemperature(score);

  await supabaseAdmin
    .from("leads")
    .update({
      lead_score: score,
      lead_temperature: temperature,
      last_activity_at: lastActivityAt,
    })
    .eq("id", leadId);

  return { score, temperature, last_activity_at: lastActivityAt };
}

/** Non-blocking refresh for hooks / webhooks. */
export function scheduleLeadScoreRefresh(leadId: string) {
  void updateLeadScore(leadId).catch((e) => console.warn("[scheduleLeadScoreRefresh]", leadId, e));
}
