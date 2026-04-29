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
 * LeadSmart **agent** checkout — three tiers:
 *   - `pro`     → `STRIPE_PRICE_ID_AGENT_PRO`     → internal `agent_starter` (Growth)
 *   - `premium` → `STRIPE_PRICE_ID_AGENT_PREMIUM` → internal `agent_pro` (Elite, solo)
 *   - `team`    → `STRIPE_PRICE_ID_TEAM`          → internal `agent_team` (Team SKU, $199/5 seats)
 *
 * Team uses `STRIPE_PRICE_ID_TEAM` as the canonical env var since
 * the price was provisioned under that name well before the agent
 * Team SKU shipped. CRM and agent flows can share the same Stripe
 * Price ID — the `internal_plan` metadata on the checkout session
 * disambiguates which entitlement tier the webhook should apply.
 *
 * Pro/Premium fall back to legacy names (STRIPE_PRICE_ID_PRO,
 * STRIPE_PRICE_ID_ELITE) if the canonical names aren't set.
 */
export function getStripePriceIdForAgentPlan(
  plan: "pro" | "premium" | "team",
): string {
  if (plan === "pro") {
    const raw =
      process.env.STRIPE_PRICE_ID_AGENT_PRO ||
      process.env.STRIPE_PRICE_ID_PRO ||
      "";
    return validateStripePriceEnv(raw || undefined, "STRIPE_PRICE_ID_AGENT_PRO");
  }
  if (plan === "team") {
    const raw =
      process.env.STRIPE_PRICE_ID_TEAM ||
      process.env.STRIPE_PRICE_ID_AGENT_TEAM ||
      "";
    return validateStripePriceEnv(raw || undefined, "STRIPE_PRICE_ID_TEAM");
  }
  // premium / elite (solo)
  const raw =
    process.env.STRIPE_PRICE_ID_AGENT_PREMIUM ||
    process.env.STRIPE_PRICE_ID_ELITE ||
    "";
  return validateStripePriceEnv(raw || undefined, "STRIPE_PRICE_ID_AGENT_PREMIUM");
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
