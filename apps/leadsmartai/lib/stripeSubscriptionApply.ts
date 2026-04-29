import type Stripe from "stripe";
import { supabaseServer } from "@/lib/supabaseServer";
import { throwIfSupabaseError } from "@/lib/supabaseThrow";
import { setUserPlanFromStripe, type Plan } from "@/lib/subscriptionSync";
import { agentPlanFromStoredPlan } from "@/lib/coaching-programs/programs";

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
  resolvedPaidPlan: "pro" | "premium" | "team" | "free";
}): "free" | "pro" | "premium" | "team" {
  if (!subscriptionStatusIndicatesPaidAccess(params.subscriptionStatus)) return "free";
  return params.resolvedPaidPlan !== "free" ? params.resolvedPaidPlan : "pro";
}

function planFromPriceId(
  priceId: string | null | undefined,
): "pro" | "premium" | "team" | null {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRICE_ID_PRO) return "pro";
  const consumerPrem = (process.env.STRIPE_PRICE_ID_CONSUMER_PREMIUM ?? "").trim();
  if (consumerPrem && priceId === consumerPrem) return "premium";
  const agentPro = (process.env.STRIPE_PRICE_ID_AGENT_PRO ?? "").trim();
  if (agentPro && priceId === agentPro) return "pro";
  const agentPremium = (process.env.STRIPE_PRICE_ID_AGENT_PREMIUM ?? "").trim();
  if (agentPremium && priceId === agentPremium) return "premium";
  const agentTeam = (process.env.STRIPE_PRICE_ID_AGENT_TEAM ?? "").trim();
  if (agentTeam && priceId === agentTeam) return "team";
  // Legacy STRIPE_PRICE_ID_TEAM fallback (CRM team uses this same env var
  // for "premium" entitlements; agent_team checkouts always set
  // internal_plan="agent_team" so the metadata branch above wins for them).
  return null;
}

/**
 * Map Stripe price + checkout metadata to a plan. Metadata is used when env price IDs
 * are misconfigured or Stripe test/live IDs differ from .env.
 */
export function resolvePaidPlanFromStripe(
  subscription: Stripe.Subscription,
  checkoutPlanMeta?: string | null,
): "pro" | "premium" | "team" | "free" {
  const internal = String(subscription.metadata?.internal_plan ?? "").trim();
  if (internal === "crm_starter") return "pro";
  if (internal === "crm_pro" || internal === "crm_team") return "premium";
  if (internal === "agent_team") return "team";

  const priceId = subscription.items.data[0]?.price?.id;
  const fromEnv = planFromPriceId(priceId);
  if (fromEnv) return fromEnv;
  const hint = String(checkoutPlanMeta ?? subscription.metadata?.plan ?? "").toLowerCase();
  if (hint === "pro" || hint === "premium" || hint === "team") return hint;
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

    await runCoachingAutoEnroll({
      authUserId: params.userId,
      stripeCustomerId: null,
      storedPlan: agentPlan,
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

    await runCoachingAutoEnroll({
      authUserId: null,
      stripeCustomerId: params.customerId,
      storedPlan: agentPlan,
    });
  }
}

/**
 * Idempotent best-effort auto-enroll into LeadSmart AI Coaching
 * programs after a Stripe-driven plan change. Resolves the
 * agents.id by either auth_user_id or stripe_customer_id depending
 * on which the webhook handler had in scope, then delegates to the
 * coaching service. Errors are logged + swallowed — coaching
 * enrollment must never block a billing webhook from succeeding.
 */
async function runCoachingAutoEnroll(args: {
  authUserId: string | null;
  stripeCustomerId: string | null;
  storedPlan: "free" | "pro" | "premium" | "team";
}): Promise<void> {
  try {
    const plan = agentPlanFromStoredPlan(args.storedPlan);
    if (!plan) return;

    let query = supabaseServer.from("agents").select("id").limit(1);
    if (args.authUserId) {
      query = query.eq("auth_user_id", args.authUserId);
    } else if (args.stripeCustomerId) {
      query = query.eq("stripe_customer_id", args.stripeCustomerId);
    } else {
      return;
    }
    const { data, error } = await query.maybeSingle();
    if (error || !data) return;

    const agentId = String((data as { id?: unknown }).id ?? "");
    if (!agentId) return;

    // Dynamic import: keeps `server-only` out of the static import
    // graph so this module's pure helpers stay test-friendly.
    const { autoEnrollForPlan } = await import(
      "@/lib/coaching-programs/service"
    );
    await autoEnrollForPlan({ agentId, plan });
  } catch (e) {
    console.warn(
      "[coaching] auto-enroll on subscription change failed:",
      (e as Error).message,
    );
  }
}
