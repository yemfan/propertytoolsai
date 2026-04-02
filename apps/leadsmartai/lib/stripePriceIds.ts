/**
 * Stripe Checkout `line_items[].price` must be a **Price** id (`price_...`),
 * not a **Product** id (`prod_...`). Using a product id causes: "No such price: 'prod_...'".
 */

/** PropertyTools / shared consumer checkout (Basic + Consumer Premium). */
export function getStripePriceIdForPlan(plan: "pro" | "premium"): string {
  const envKey = plan === "pro" ? "STRIPE_PRICE_ID_PRO" : "STRIPE_PRICE_ID_CONSUMER_PREMIUM";
  const raw = plan === "pro" ? process.env.STRIPE_PRICE_ID_PRO : process.env.STRIPE_PRICE_ID_CONSUMER_PREMIUM;
  return validateStripePriceEnv(raw, envKey);
}

/**
 * LeadSmart **agent** checkout (Growth vs Elite entitlements).
 * - `pro` → `STRIPE_PRICE_ID_AGENT_PRO` → internal `agent_starter` (Growth)
 * - `premium` → `STRIPE_PRICE_ID_AGENT_PREMIUM` → internal `agent_pro` (Elite)
 */
export function getStripePriceIdForAgentPlan(plan: "pro" | "premium"): string {
  const envKey =
    plan === "pro" ? "STRIPE_PRICE_ID_AGENT_PRO" : "STRIPE_PRICE_ID_AGENT_PREMIUM";
  const raw =
    plan === "pro" ? process.env.STRIPE_PRICE_ID_AGENT_PRO : process.env.STRIPE_PRICE_ID_AGENT_PREMIUM;
  return validateStripePriceEnv(raw, envKey);
}

function validateStripePriceEnv(raw: string | undefined, envKey: string): string {
  const v = (raw ?? "").trim();

  if (!v) {
    throw new Error(
      `Missing ${envKey}. Add a Stripe Price ID to .env.local (starts with price_). See docs/LEADSMART_STRIPE_BILLING.md.`
    );
  }

  if (v.startsWith("prod_")) {
    throw new Error(
      `${envKey} is set to a Product ID (${v}). Checkout needs a Price ID. In Stripe Dashboard: Products → open the product → under Pricing, copy the Price ID (price_…), not the Product ID (prod_…).`
    );
  }

  if (!v.startsWith("price_")) {
    throw new Error(
      `${envKey} must be a Stripe Price ID starting with price_. Got: ${v.slice(0, 32)}`
    );
  }

  return v;
}
