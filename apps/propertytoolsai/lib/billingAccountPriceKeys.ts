/**
 * Maps UI / checkout `priceId` keys (not Stripe ids) to env-backed Stripe Price IDs.
 * Falls back to STRIPE_PRICE_ID_PRO where noted for agent/loan keys when specific keys are unset.
 */

export const BILLING_CHECKOUT_PRICE_KEYS = [
  "price_consumer_premium",
  "price_agent_starter",
  "price_agent_pro",
  "price_loan_broker_pro",
] as const;

export type BillingCheckoutPriceKey = (typeof BILLING_CHECKOUT_PRICE_KEYS)[number];

export type BillingPlanKey =
  | "consumer_free"
  | "consumer_premium"
  | "agent_starter"
  | "agent_pro"
  | "loan_broker_pro";

function requirePriceId(raw: string | undefined, envName: string): string {
  const v = (raw ?? "").trim();
  if (!v) {
    throw new Error(
      `Missing ${envName}. Add a Stripe Price ID (price_…) to .env.local. See ENV.md → Stripe.`
    );
  }
  if (v.startsWith("prod_")) {
    throw new Error(
      `${envName} must be a Price ID (price_…), not a Product ID (${v.slice(0, 24)}…).`
    );
  }
  if (!v.startsWith("price_")) {
    throw new Error(`${envName} must start with price_. Got: ${v.slice(0, 32)}`);
  }
  return v;
}

/** Resolve Stripe `price_…` id for a checkout key from env (with sensible fallbacks). */
export function getStripePriceIdForBillingCheckoutKey(key: string): string {
  switch (key) {
    case "price_consumer_premium":
      return requirePriceId(process.env.STRIPE_PRICE_ID_CONSUMER_PREMIUM, "STRIPE_PRICE_ID_CONSUMER_PREMIUM");
    case "price_agent_starter":
      return requirePriceId(
        process.env.STRIPE_PRICE_ID_AGENT_STARTER ?? process.env.STRIPE_PRICE_ID_PRO,
        "STRIPE_PRICE_ID_AGENT_STARTER (or STRIPE_PRICE_ID_PRO)"
      );
    case "price_agent_pro":
      return requirePriceId(
        process.env.STRIPE_PRICE_ID_AGENT_PRO ?? process.env.STRIPE_PRICE_ID_PRO,
        "STRIPE_PRICE_ID_AGENT_PRO (or STRIPE_PRICE_ID_PRO)"
      );
    case "price_loan_broker_pro":
      return requirePriceId(
        process.env.STRIPE_PRICE_ID_LOAN_BROKER_PRO ?? process.env.STRIPE_PRICE_ID_PRO,
        "STRIPE_PRICE_ID_LOAN_BROKER_PRO (or STRIPE_PRICE_ID_PRO)"
      );
    default:
      throw new Error(`Unknown billing price key: ${key}`);
  }
}

export function isBillingCheckoutPriceKey(key: string): key is BillingCheckoutPriceKey {
  return (BILLING_CHECKOUT_PRICE_KEYS as readonly string[]).includes(key);
}

/** Stored on Stripe metadata / `billing_subscriptions.plan`. */
export function getBillingPlanFromCheckoutKey(key: BillingCheckoutPriceKey): BillingPlanKey {
  switch (key) {
    case "price_consumer_premium":
      return "consumer_premium";
    case "price_agent_starter":
      return "agent_starter";
    case "price_agent_pro":
      return "agent_pro";
    case "price_loan_broker_pro":
      return "loan_broker_pro";
    default:
      return "consumer_premium";
  }
}
