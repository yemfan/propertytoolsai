import { supabaseServer } from "@/lib/supabaseServer";
import { toErrorFromSupabase } from "@/lib/supabaseError";

export type Plan = "free" | "pro" | "premium";
export type SubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "incomplete"
  | "incomplete_expired"
  | "unpaid"
  | string;

function planTokens(plan: Plan) {
  if (plan === "pro") return 100;
  if (plan === "premium") return 300;
  return 10;
}

export async function setUserPlanFromStripe(params: {
  userId: string;
  plan: Plan;
  subscriptionStatus: SubscriptionStatus;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  resetTokens?: boolean;
  /** When set (including `null`), syncs `trial_ends_at` from Stripe. Omit to leave column unchanged. */
  trialEndsAt?: string | null;
}) {
  const tokens = planTokens(params.plan);
  const nextReset = new Date();
  nextReset.setUTCMonth(nextReset.getUTCMonth() + 1, 1);
  nextReset.setUTCHours(0, 0, 0, 0);

  // Keep tokens in sync whenever plan changes. On downgrade/cancel, resetTokens=true.
  const update: Record<string, unknown> = {
    plan: params.plan,
    subscription_status: params.subscriptionStatus,
    stripe_customer_id: params.stripeCustomerId ?? null,
    stripe_subscription_id: params.stripeSubscriptionId ?? null,
  };

  if (params.resetTokens) {
    update.tokens_remaining = tokens;
    update.tokens_reset_date = nextReset.toISOString();
  }

  if (params.trialEndsAt !== undefined) {
    update.trial_ends_at = params.trialEndsAt;
  }

  const { data: existingLs, error: selErr } = await supabaseServer
    .from("leadsmart_users")
    .select("user_id")
    .eq("user_id", params.userId)
    .maybeSingle();

  if (selErr) throw toErrorFromSupabase(selErr, "Could not read leadsmart_users");

  if (existingLs) {
    const { error } = await supabaseServer.from("leadsmart_users").update(update).eq("user_id", params.userId);
    if (error) throw toErrorFromSupabase(error, "Could not update leadsmart_users");
    return;
  }

  const { error: upErr } = await supabaseServer
    .from("user_profiles")
    .upsert({ user_id: params.userId } as never, { onConflict: "user_id" });
  if (upErr) throw toErrorFromSupabase(upErr, "Could not ensure user_profiles");

  const insertRow: Record<string, unknown> = {
    user_id: params.userId,
    role: "user",
    ...update,
    tokens_remaining: tokens,
    tokens_reset_date: nextReset.toISOString(),
  };

  const { error: insErr } = await supabaseServer.from("leadsmart_users").insert(insertRow);
  if (insErr) throw toErrorFromSupabase(insErr, "Could not create leadsmart_users");
}

