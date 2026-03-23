import type Stripe from "stripe";
import type { InternalPlan } from "@/lib/billing/stripe-plan-map";
import {
  mapStripePriceToPlan,
  resolveInternalPlanFromStripeSubscription,
} from "@/lib/billing/stripe-plan-map";
import { planRowFromCatalog } from "@/lib/entitlements/planCatalog";
import type { AgentPlan } from "@/lib/entitlements/types";
import { PRODUCT_LEADSMART_AGENT } from "@/lib/entitlements/product";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe/server";

function toIsoOrNull(unixSeconds?: number | null) {
  if (unixSeconds == null || unixSeconds === 0) return null;
  return new Date(unixSeconds * 1000).toISOString();
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

async function getProfileByCustomerEmail(email?: string | null) {
  if (!email) return null;

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, email, full_name, role")
    .eq("email", email)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * Stripe `agent_starter` / `agent_pro` price IDs map to Growth / Elite limits in `product_entitlements`.
 */
function billingPlanToAgentPlan(billingPlan: InternalPlan): AgentPlan {
  if (billingPlan === "agent_starter") return "growth";
  if (billingPlan === "agent_pro") return "elite";
  return "starter";
}

/**
 * Deactivate prior active rows, then insert a new entitlement row (matches DB partial unique index).
 */
async function syncAgentEntitlement(params: {
  userId: string | null;
  billingPlan: InternalPlan;
  active: boolean;
}) {
  if (!params.userId) return;

  if (params.billingPlan !== "agent_starter" && params.billingPlan !== "agent_pro") {
    return;
  }

  const normalizedPlan = billingPlanToAgentPlan(params.billingPlan);
  const limits = planRowFromCatalog(normalizedPlan);
  const now = new Date().toISOString();

  const { error: deactErr } = await supabaseAdmin
    .from("product_entitlements")
    .update({ is_active: false, updated_at: now })
    .eq("user_id", params.userId)
    .eq("product", PRODUCT_LEADSMART_AGENT);

  if (deactErr) throw deactErr;

  if (!params.active) return;

  const { error: insErr } = await supabaseAdmin.from("product_entitlements").insert({
    user_id: params.userId,
    product: PRODUCT_LEADSMART_AGENT,
    plan: limits.plan,
    is_active: true,
    cma_reports_per_day: limits.cma_reports_per_day,
    max_leads: limits.max_leads,
    max_contacts: limits.max_contacts,
    alerts_level: limits.alerts_level,
    reports_download_level: limits.reports_download_level,
    team_access: limits.team_access,
    source: "stripe",
    starts_at: now,
    updated_at: now,
  });

  if (insErr) throw insErr;
}

async function resolveCustomerContact(subscription: Stripe.Subscription): Promise<{
  email: string | null;
  name: string | null;
}> {
  const c = subscription.customer;

  if (c && typeof c !== "string") {
    const cust = c as Stripe.Customer;
    return { email: cust.email ?? null, name: cust.name ?? null };
  }

  if (typeof c === "string") {
    const retrieved = await stripe.customers.retrieve(c);
    if ("deleted" in retrieved && retrieved.deleted) {
      return { email: null, name: null };
    }
    const cust = retrieved as Stripe.Customer;
    return {
      email: cust.email ?? null,
      name: cust.name ?? null,
    };
  }

  return { email: null, name: null };
}

export async function syncStripeSubscription(subscription: Stripe.Subscription) {
  const customerId =
    typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;

  const firstItem = subscription.items.data[0];
  const priceId = firstItem?.price?.id ?? null;
  const amountMonthly = firstItem?.price?.unit_amount
    ? firstItem.price.unit_amount / 100
    : 0;

  let { email: customerEmail, name: customerName } = await resolveCustomerContact(subscription);

  if (!customerEmail && subscription.metadata?.email) {
    customerEmail = String(subscription.metadata.email);
  }

  const profile = await getProfileByCustomerEmail(customerEmail);
  const metadataUserId =
    typeof subscription.metadata?.user_id === "string" ? subscription.metadata.user_id : null;
  /** Prefer Stripe metadata from Checkout (authoritative) over email → profiles lookup. */
  const userId = metadataUserId ?? profile?.id ?? null;

  const fromPriceOnly = mapStripePriceToPlan(priceId);
  const internalPlan = resolveInternalPlanFromStripeSubscription(priceId, subscription.metadata);
  if (internalPlan !== fromPriceOnly) {
    console.info("[syncStripeSubscription] internal_plan from subscription metadata (price map was different)", {
      subscriptionId: subscription.id,
      priceId,
      fromPriceOnly,
      resolvedPlan: internalPlan,
      metadata: subscription.metadata,
    });
  }

  /** Stripe API returns these on `Subscription`; some TS versions omit them from the type. */
  const subPeriod = subscription as unknown as {
    current_period_start?: number;
    current_period_end?: number;
  };
  const periodStart = toIsoOrNull(
    subPeriod.current_period_start ?? firstItem?.current_period_start
  );
  const periodEnd = toIsoOrNull(subPeriod.current_period_end ?? firstItem?.current_period_end);

  const record = {
    user_id: userId,
    email: customerEmail ?? "unknown@example.com",
    full_name: profile?.full_name ?? customerName ?? null,
    role: profile?.role ?? "consumer",
    plan: internalPlan,
    status: mapStripeStatus(subscription.status),
    amount_monthly: amountMonthly,
    billing_provider: "stripe",
    provider_customer_id: customerId,
    provider_subscription_id: subscription.id,
    provider_price_id: priceId,
    current_period_start: periodStart,
    current_period_end: periodEnd,
    cancel_at_period_end: subscription.cancel_at_period_end ?? false,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabaseAdmin.from("billing_subscriptions").upsert(record, {
    onConflict: "provider_subscription_id",
  });

  if (error) throw error;

  const isActive = subscription.status === "active" || subscription.status === "trialing";

  await syncAgentEntitlement({
    userId,
    billingPlan: internalPlan,
    active: isActive,
  });
}

export async function markSubscriptionCanceled(subscriptionId: string) {
  const { data: subscriptionRow, error: fetchError } = await supabaseAdmin
    .from("billing_subscriptions")
    .select("user_id, plan")
    .eq("provider_subscription_id", subscriptionId)
    .maybeSingle();

  if (fetchError) throw fetchError;

  const { error } = await supabaseAdmin
    .from("billing_subscriptions")
    .update({
      status: "canceled",
      updated_at: new Date().toISOString(),
    })
    .eq("provider_subscription_id", subscriptionId);

  if (error) throw error;

  if (
    subscriptionRow?.user_id &&
    (subscriptionRow.plan === "agent_starter" || subscriptionRow.plan === "agent_pro")
  ) {
    await syncAgentEntitlement({
      userId: subscriptionRow.user_id,
      billingPlan: subscriptionRow.plan as InternalPlan,
      active: false,
    });
  }
}

function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const inv = invoice as unknown as {
    subscription?: string | Stripe.Subscription | null;
    parent?: { subscription_details?: { subscription?: string | Stripe.Subscription } | null } | null;
  };
  if (inv.subscription != null) {
    return typeof inv.subscription === "string" ? inv.subscription : inv.subscription.id;
  }
  const nested = inv.parent?.subscription_details?.subscription;
  if (nested != null) {
    return typeof nested === "string" ? nested : nested.id;
  }
  return null;
}

export async function markInvoiceFailed(invoice: Stripe.Invoice) {
  const subscriptionId = invoiceSubscriptionId(invoice);
  if (!subscriptionId) return;

  const { error } = await supabaseAdmin
    .from("billing_subscriptions")
    .update({
      status: "past_due",
      updated_at: new Date().toISOString(),
    })
    .eq("provider_subscription_id", subscriptionId);

  if (error) throw error;
}

export async function markInvoicePaid(invoice: Stripe.Invoice) {
  const subscriptionId = invoiceSubscriptionId(invoice);
  if (!subscriptionId) return;

  const { data: subscriptionRow, error: fetchError } = await supabaseAdmin
    .from("billing_subscriptions")
    .select("user_id, plan")
    .eq("provider_subscription_id", subscriptionId)
    .maybeSingle();

  if (fetchError) throw fetchError;

  const { error } = await supabaseAdmin
    .from("billing_subscriptions")
    .update({
      status: "active",
      updated_at: new Date().toISOString(),
    })
    .eq("provider_subscription_id", subscriptionId);

  if (error) throw error;

  if (
    subscriptionRow?.user_id &&
    (subscriptionRow.plan === "agent_starter" || subscriptionRow.plan === "agent_pro")
  ) {
    await syncAgentEntitlement({
      userId: subscriptionRow.user_id,
      billingPlan: subscriptionRow.plan as InternalPlan,
      active: true,
    });
  }
}
