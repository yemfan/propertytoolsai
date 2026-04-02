/**
 * Stripe Checkout `line_items[].price` must be a **Price** id (`price_...`),
 * not a **Product** id (`prod_...`). Using a product id causes: "No such price: 'prod_...'".
 */
export function getStripePriceIdForPlan(plan: "pro" | "premium"): string {
  if (plan === "pro") {
    const envKey = "STRIPE_PRICE_ID_PRO";
    const v = (process.env.STRIPE_PRICE_ID_PRO ?? "").trim();
    return validatePriceId(v, envKey);
  }

  const envKey = "STRIPE_PRICE_ID_CONSUMER_PREMIUM";
  const v = (process.env.STRIPE_PRICE_ID_CONSUMER_PREMIUM ?? "").trim();

  if (!v) {
    throw new Error(
      `Missing STRIPE_PRICE_ID_CONSUMER_PREMIUM (Consumer Premium). Add a Stripe Price ID to .env.local (starts with price_). See ENV.md → Stripe.`
    );
  }

  return validatePriceId(v, envKey);
}

function validatePriceId(v: string, envKey: string): string {
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
