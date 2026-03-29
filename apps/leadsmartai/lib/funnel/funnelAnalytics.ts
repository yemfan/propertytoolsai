import { supabaseAdmin } from "@/lib/supabase/admin";

export type FunnelEventType =
  | "onboarding_completed"
  | "first_reply"
  | "first_ai_usage"
  | "upgrade_modal_prompt"
  | "upgrade_checkout_started"
  | "subscription_active_crm";

/**
 * Idempotent-ish analytics: same user may emit multiple upgrade prompts (throttle client-side if needed).
 */
export async function recordFunnelEvent(
  userId: string,
  eventType: FunnelEventType,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  try {
    const { error } = await supabaseAdmin.from("leadsmart_funnel_events").insert({
      user_id: userId,
      event_type: eventType,
      metadata,
    } as Record<string, unknown>);
    if (error) console.error("recordFunnelEvent", eventType, error.message);
  } catch (e) {
    console.error("recordFunnelEvent", eventType, e);
  }
}

export async function markOnboardingCompleted(userId: string, source?: string): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabaseAdmin.from("leadsmart_funnel_state").upsert(
    {
      user_id: userId,
      onboarding_completed_at: now,
      updated_at: now,
    },
    { onConflict: "user_id" }
  );
  if (error) {
    console.error("markOnboardingCompleted", error.message);
    return;
  }
  await recordFunnelEvent(userId, "onboarding_completed", { source: source ?? "unknown" });
}

export async function markFirstReply(userId: string, channel: "sms" | "email"): Promise<void> {
  const { data: row } = await supabaseAdmin
    .from("leadsmart_funnel_state")
    .select("first_reply_at")
    .eq("user_id", userId)
    .maybeSingle();

  const existing = (row as { first_reply_at?: string | null } | null)?.first_reply_at;
  if (existing) return;

  const now = new Date().toISOString();
  const { error } = await supabaseAdmin.from("leadsmart_funnel_state").upsert(
    {
      user_id: userId,
      first_reply_at: now,
      updated_at: now,
    },
    { onConflict: "user_id" }
  );
  if (error) {
    console.error("markFirstReply", error.message);
    return;
  }

  await recordFunnelEvent(userId, "first_reply", { channel });
}

export async function recordUpgradeCheckoutStarted(userId: string, plan: string): Promise<void> {
  await recordFunnelEvent(userId, "upgrade_checkout_started", { plan });
}
