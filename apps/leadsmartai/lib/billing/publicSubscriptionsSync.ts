import type Stripe from "stripe";
import type { InternalPlan } from "@/lib/billing/stripe-plan-map";
import type { PlanSlug } from "@/lib/billing/plans";
import { recordSubscriptionEvent } from "@/lib/analytics/analyticsEvents";
import { SUBSCRIPTION_EVENT_TYPES } from "@/lib/analytics/eventCatalog";
import { recordFunnelEvent } from "@/lib/funnel/funnelAnalytics";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Maps Stripe subscription rows (CRM + legacy agent SKUs) to public `subscriptions.plan` slugs.
 */
export function mapInternalPlanToCrmSlug(plan: InternalPlan): PlanSlug | null {
  switch (plan) {
    case "crm_starter":
      return "starter";
    case "crm_pro":
      return "pro";
    case "crm_team":
      return "team";
    case "agent_starter":
      return "pro";
    case "agent_pro":
      return "team";
    default:
      return null;
  }
}

function mapStripeStatus(status: Stripe.Subscription.Status): string {
  switch (status) {
    case "active":
      return "active";
    case "trialing":
      return "trialing";
    case "past_due":
      return "past_due";
    case "canceled":
    case "unpaid":
    case "incomplete_expired":
      return "canceled";
    case "incomplete":
      return "incomplete";
    case "paused":
      return "incomplete";
    default:
      return "incomplete";
  }
}

export async function syncPublicSubscriptionFromStripe(params: {
  userId: string | null;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  internalPlan: InternalPlan;
  subscription: Stripe.Subscription;
  currentPeriodEnd: string | null;
}): Promise<void> {
  const slug = mapInternalPlanToCrmSlug(params.internalPlan);
  const status = mapStripeStatus(params.subscription.status);

  if (!params.userId) {
    return;
  }

  if (!slug) {
    const { error } = await supabaseAdmin
      .from("subscriptions")
      .delete()
      .eq("stripe_subscription_id", params.stripeSubscriptionId);
    if (error) throw error;
    return;
  }

  const { data: priorSub } = await supabaseAdmin
    .from("subscriptions")
    .select("plan, status")
    .eq("stripe_subscription_id", params.stripeSubscriptionId)
    .maybeSingle();

  const prior = priorSub as { plan: string; status: string } | null;
  const crmChanged =
    !prior || prior.plan !== slug || prior.status !== status;

  const now = new Date().toISOString();
  const { error } = await supabaseAdmin.from("subscriptions").upsert(
    {
      user_id: params.userId,
      stripe_customer_id: params.stripeCustomerId,
      stripe_subscription_id: params.stripeSubscriptionId,
      plan: slug,
      status,
      current_period_end: params.currentPeriodEnd,
      updated_at: now,
    },
    { onConflict: "stripe_subscription_id" }
  );

  if (error) throw error;

  if (status === "active" || status === "trialing") {
    void recordFunnelEvent(params.userId, "subscription_active_crm", {
      plan: slug,
      stripe_subscription_id: params.stripeSubscriptionId,
    });
    if (crmChanged) {
      void recordSubscriptionEvent({
        userId: params.userId,
        eventType: SUBSCRIPTION_EVENT_TYPES.CRM_SUBSCRIPTION_ACTIVE,
        plan: slug,
        amount: null,
        stripeSubscriptionId: params.stripeSubscriptionId,
        metadata: { source: "crm_stripe_mirror" },
      });
    }
  }
}

export async function updatePublicSubscriptionStatusByStripeId(
  stripeSubscriptionId: string,
  status: string
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from("subscriptions")
    .update({ status, updated_at: now })
    .eq("stripe_subscription_id", stripeSubscriptionId);
  if (error) throw error;
}
