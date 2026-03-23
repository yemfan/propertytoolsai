import type Stripe from "stripe";
import { supabaseServer } from "@/lib/supabaseServer";
import { throwIfSupabaseError } from "@/lib/supabaseThrow";
import { setUserPlanFromStripe, type Plan } from "@/lib/subscriptionSync";

/** Checkout Session: customer completed payment or no charge is due yet (e.g. trial). */
export function checkoutPaymentIndicatesSuccess(
  paymentStatus: Stripe.Checkout.Session["payment_status"] | null | undefined
): boolean {
  return paymentStatus === "paid" || paymentStatus === "no_payment_required";
}

/** Subscription row: entitled to paid features in our app. */
export function subscriptionStatusIndicatesPaidAccess(
  status: Stripe.Subscription["status"]
): boolean {
  return status === "active" || status === "trialing";
}

/**
 * After Checkout redirect: allow syncing DB if payment looks OK *or* Stripe already put the
 * subscription in a paid-capable state (covers trial flows where `payment_status` may be `unpaid`).
 */
export function checkoutSuccessShouldSyncSubscription(params: {
  paymentStatus: Stripe.Checkout.Session["payment_status"] | null | undefined;
  subscriptionStatus: Stripe.Subscription["status"];
}): boolean {
  return (
    checkoutPaymentIndicatesSuccess(params.paymentStatus) ||
    subscriptionStatusIndicatesPaidAccess(params.subscriptionStatus)
  );
}

/** Maps Stripe subscription status + resolved SKU to the plan stored on `agents` / `user_profiles`. */
export function computeAgentPlanFromSubscriptionSync(params: {
  subscriptionStatus: Stripe.Subscription["status"];
  resolvedPaidPlan: "pro" | "premium" | "free";
}): "free" | "pro" | "premium" {
  if (!subscriptionStatusIndicatesPaidAccess(params.subscriptionStatus)) return "free";
  return params.resolvedPaidPlan !== "free" ? params.resolvedPaidPlan : "pro";
}

function planFromPriceId(priceId: string | null | undefined): "pro" | "premium" | null {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRICE_ID_PRO) return "pro";
  if (priceId === process.env.STRIPE_PRICE_ID_PREMIUM) return "premium";
  return null;
}

/**
 * Map Stripe price + checkout metadata to a plan. Metadata is used when env price IDs
 * are misconfigured or Stripe test/live IDs differ from .env.
 */
export function resolvePaidPlanFromStripe(
  subscription: Stripe.Subscription,
  checkoutPlanMeta?: string | null
): "pro" | "premium" | "free" {
  const priceId = subscription.items.data[0]?.price?.id;
  const fromEnv = planFromPriceId(priceId);
  if (fromEnv) return fromEnv;
  const hint = String(checkoutPlanMeta ?? subscription.metadata?.plan ?? "").toLowerCase();
  if (hint === "pro" || hint === "premium") return hint;
  return "free";
}

/**
 * Updates `agents` + `user_profiles` from a Stripe subscription (webhook or return from Checkout).
 */
export async function persistAgentAndProfileFromSubscription(params: {
  userId: string | null;
  customerId: string | null;
  subscriptionId: string;
  subscription: Stripe.Subscription;
  checkoutPlanMeta?: string | null;
}): Promise<void> {
  const sub = params.subscription;
  const status = sub.status;
  const paidPlan = resolvePaidPlanFromStripe(sub, params.checkoutPlanMeta);
  const agentPlan = computeAgentPlanFromSubscriptionSync({
    subscriptionStatus: status,
    resolvedPaidPlan: paidPlan,
  });

  const trialEndsAt =
    sub.trial_end != null ? new Date(sub.trial_end * 1000).toISOString() : null;

  if (params.userId) {
    const { data: existingAgent, error: selAgentErr } = await supabaseServer
      .from("agents")
      .select("id")
      .eq("auth_user_id", params.userId)
      .maybeSingle();
    throwIfSupabaseError(selAgentErr, "Could not load agents row");

    const agentPayload = {
      plan_type: agentPlan,
      stripe_customer_id: params.customerId ?? null,
      stripe_subscription_id: params.subscriptionId,
    };

    if (existingAgent) {
      const { error } = await supabaseServer.from("agents").update(agentPayload).eq("auth_user_id", params.userId);
      if (error) throw error;
    } else {
      const { error } = await supabaseServer.from("agents").insert({
        auth_user_id: params.userId,
        ...agentPayload,
      } as Record<string, unknown>);
      if (error) throw error;
    }

    const profilePlan: Plan = agentPlan === "free" ? "free" : agentPlan;
    await setUserPlanFromStripe({
      userId: params.userId,
      plan: profilePlan,
      subscriptionStatus: status,
      stripeCustomerId: params.customerId ?? null,
      stripeSubscriptionId: params.subscriptionId,
      resetTokens: agentPlan === "free",
      trialEndsAt,
    });
    return;
  }

  if (params.customerId) {
    const { error } = await supabaseServer
      .from("agents")
      .update({
        plan_type: agentPlan,
        stripe_customer_id: params.customerId ?? null,
        stripe_subscription_id: params.subscriptionId,
      })
      .eq("stripe_customer_id", params.customerId);
    throwIfSupabaseError(error, "Could not update agents by customer id");
  }
}
