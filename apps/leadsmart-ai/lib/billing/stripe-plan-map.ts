/**
 * Canonical product/plan keys (admin UI + `billing_subscriptions.plan`).
 * Keep aligned with `BillingPlan` in `@/lib/admin/billingRecords`.
 */
export type InternalPlan =
  | "consumer_free"
  | "consumer_premium"
  | "agent_starter"
  | "agent_pro"
  | "loan_broker_pro";

/** Demo / fixture Price IDs. In production, also set `STRIPE_PRICE_ID_*` env vars (see `mapStripePriceToPlan`). */
const PRICE_ID_TO_PLAN: Record<string, InternalPlan> = {
  price_consumer_premium: "consumer_premium",
  price_agent_starter: "agent_starter",
  price_agent_pro: "agent_pro",
  price_loan_broker_pro: "loan_broker_pro",
};

function planFromEnv(priceId: string): InternalPlan | undefined {
  if (priceId === process.env.STRIPE_PRICE_ID_PRO) return "agent_starter";
  if (priceId === process.env.STRIPE_PRICE_ID_PREMIUM) return "agent_pro";
  if (process.env.STRIPE_PRICE_ID_CONSUMER_PREMIUM && priceId === process.env.STRIPE_PRICE_ID_CONSUMER_PREMIUM) {
    return "consumer_premium";
  }
  if (process.env.STRIPE_PRICE_ID_AGENT_STARTER && priceId === process.env.STRIPE_PRICE_ID_AGENT_STARTER) {
    return "agent_starter";
  }
  if (process.env.STRIPE_PRICE_ID_AGENT_PRO && priceId === process.env.STRIPE_PRICE_ID_AGENT_PRO) {
    return "agent_pro";
  }
  if (process.env.STRIPE_PRICE_ID_LOAN_BROKER_PRO && priceId === process.env.STRIPE_PRICE_ID_LOAN_BROKER_PRO) {
    return "loan_broker_pro";
  }
  return undefined;
}

export function mapStripePriceToPlan(priceId?: string | null): InternalPlan {
  if (!priceId) return "consumer_free";
  return PRICE_ID_TO_PLAN[priceId] ?? planFromEnv(priceId) ?? "consumer_free";
}

const INTERNAL_PLAN_VALUES: InternalPlan[] = [
  "consumer_free",
  "consumer_premium",
  "agent_starter",
  "agent_pro",
  "loan_broker_pro",
];

/**
 * Prefer `internal_plan` on the Stripe Subscription (set by Checkout `subscription_data.metadata`)
 * when the live Price ID is not yet in `PRICE_ID_TO_PLAN` / env — otherwise paid checkouts map to
 * `consumer_free` and never sync `product_entitlements`.
 */
export function resolveInternalPlanFromStripeSubscription(
  priceId: string | null | undefined,
  metadata: { internal_plan?: string | null } | null | undefined
): InternalPlan {
  const raw = String(metadata?.internal_plan ?? "").trim();
  if (raw && INTERNAL_PLAN_VALUES.includes(raw as InternalPlan)) {
    return raw as InternalPlan;
  }
  return mapStripePriceToPlan(priceId ?? null);
}
