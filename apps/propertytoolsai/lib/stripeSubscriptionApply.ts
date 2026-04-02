import type Stripe from "stripe";
import { supabaseServer } from "@/lib/supabaseServer";
import { toErrorFromSupabase } from "@/lib/supabaseError";
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
  const consumerPrem = (process.env.STRIPE_PRICE_ID_CONSUMER_PREMIUM ?? "").trim();
  if (consumerPrem && priceId === consumerPrem) return "premium";
  // Account billing checkout may use dedicated price envs (see lib/billingAccountPriceKeys.ts)
  if (
    (process.env.STRIPE_PRICE_ID_AGENT_STARTER && priceId === process.env.STRIPE_PRICE_ID_AGENT_STARTER) ||
    (process.env.STRIPE_PRICE_ID_AGENT_PRO && priceId === process.env.STRIPE_PRICE_ID_AGENT_PRO) ||
    (process.env.STRIPE_PRICE_ID_LOAN_BROKER_PRO && priceId === process.env.STRIPE_PRICE_ID_LOAN_BROKER_PRO)
  ) {
    return "pro";
  }
  return null;
}

/**
 * Map Checkout / Subscription metadata (`plan`, `billing_plan`) to app plan.
 * Account checkout uses `billing_plan` (e.g. consumer_premium).
 */
function planFromMetadataHint(hintRaw: string | null | undefined): "pro" | "premium" | "free" {
  const hint = String(hintRaw ?? "")
    .trim()
    .toLowerCase();
  if (!hint) return "free";
  if (hint === "pro" || hint === "premium") return hint;
  if (hint === "consumer_premium" || hint === "elite" || hint.includes("premium")) return "premium";
  if (hint === "agent_starter" || hint === "agent_pro" || hint === "loan_broker_pro") return "pro";
  return "free";
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

  const combinedHint =
    checkoutPlanMeta ??
    subscription.metadata?.plan ??
    (subscription.metadata as Record<string, string | undefined>)?.billing_plan ??
    "";
  const fromMeta = planFromMetadataHint(combinedHint);
  if (fromMeta !== "free") return fromMeta;
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
    if (selAgentErr) throw toErrorFromSupabase(selAgentErr, "Could not load agents row");

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
    if (error) throw toErrorFromSupabase(error, "Could not update agents by customer id");
  }
}
