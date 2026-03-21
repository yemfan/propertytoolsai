import { supabaseServer } from "@/lib/supabaseServer";

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
}) {
  const tokens = planTokens(params.plan);
  const nextReset = new Date();
  nextReset.setUTCMonth(nextReset.getUTCMonth() + 1, 1);
  nextReset.setUTCHours(0, 0, 0, 0);

  // Keep tokens in sync whenever plan changes. On downgrade/cancel, resetTokens=true.
  const update: any = {
    plan: params.plan,
    subscription_status: params.subscriptionStatus,
    stripe_customer_id: params.stripeCustomerId ?? null,
    stripe_subscription_id: params.stripeSubscriptionId ?? null,
  };

  if (params.resetTokens) {
    update.tokens_remaining = tokens;
    update.tokens_reset_date = nextReset.toISOString();
  }

  const { error } = await supabaseServer
    .from("user_profiles")
    .update(update)
    .eq("user_id", params.userId);

  if (error) throw error;
}

