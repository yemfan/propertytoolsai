import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Best-effort usage tracking; never throws (analytics must not break core flows).
 */
export async function recordUsageEvent(
  userId: string | null,
  eventType: string,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  try {
    const { error } = await supabaseAdmin.from("usage_events").insert({
      user_id: userId,
      event_type: eventType,
      metadata,
    } as Record<string, unknown>);
    if (error) console.error("[recordUsageEvent]", eventType, error.message);
  } catch (e) {
    console.error("[recordUsageEvent]", eventType, e);
  }
}

export type RecordSubscriptionEventInput = {
  userId: string | null;
  eventType: string;
  plan?: string | null;
  amount?: number | null;
  stripeSubscriptionId?: string | null;
  metadata?: Record<string, unknown>;
};

/**
 * Append-only subscription / billing analytics.
 */
export async function recordSubscriptionEvent(input: RecordSubscriptionEventInput): Promise<void> {
  try {
    const { error } = await supabaseAdmin.from("subscription_events").insert({
      user_id: input.userId,
      event_type: input.eventType,
      plan: input.plan ?? null,
      amount: input.amount ?? null,
      stripe_subscription_id: input.stripeSubscriptionId ?? null,
      metadata: input.metadata ?? {},
    } as Record<string, unknown>);
    if (error) console.error("[recordSubscriptionEvent]", input.eventType, error.message);
  } catch (e) {
    console.error("[recordSubscriptionEvent]", input.eventType, e);
  }
}
