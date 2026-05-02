import type { InternalPlan } from "@/lib/billing/stripe-plan-map";
import { PLANS, type PlanSlug } from "@/lib/billing/plans";

/**
 * Backward-compat env var aliases.
 *
 * The catalog renamed slugs to align with the marketing tiers
 * (Starter Free / Pro $49 / Premium $99 / Team $199). The old
 * deployments wired the $99 product to STRIPE_PRICE_ID_ELITE and
 * never had a STRIPE_PRICE_ID_PREMIUM. Keep the lookup forgiving so
 * existing .env.local files keep working — preferred name wins,
 * legacy name is a fallback.
 */
const ENV_VAR_FALLBACKS: Record<string, string> = {
  STRIPE_PRICE_ID_PREMIUM: "STRIPE_PRICE_ID_ELITE",
};

function readEnvWithFallback(envKey: string): string {
  const direct = (process.env[envKey] ?? "").trim();
  if (direct) return direct;
  const fallbackKey = ENV_VAR_FALLBACKS[envKey];
  if (fallbackKey) {
    return (process.env[fallbackKey] ?? "").trim();
  }
  return "";
}

/**
 * Monthly Stripe Price ID (`price_…`) for a CRM tier. Throws on
 * misconfiguration so checkout fails loudly instead of silently
 * landing the user on the wrong product.
 *
 * Free tiers (Starter) intentionally don't have a Stripe Price ID —
 * calling this with a free slug throws. Callers that handle free
 * separately should branch on `PLANS[slug].stripePriceEnvVar` first.
 */
export function getCrmStripePriceId(plan: PlanSlug): string {
  const envKey = PLANS[plan].stripePriceEnvVar;
  if (!envKey) {
    throw new Error(
      `Plan "${plan}" is free and has no Stripe Price ID. Branch on PLANS[slug].stripePriceEnvVar before calling getCrmStripePriceId.`,
    );
  }

  const v = readEnvWithFallback(envKey);
  const fallbackKey = ENV_VAR_FALLBACKS[envKey];
  const lookupSummary = fallbackKey ? `${envKey} (or ${fallbackKey})` : envKey;

  if (!v) {
    throw new Error(
      `Missing ${lookupSummary}. Add a recurring monthly Stripe Price ID for the ${plan} CRM plan.`,
    );
  }
  if (v.startsWith("prod_")) {
    throw new Error(
      `${lookupSummary} must be a Price ID (price_…), not a Product ID (prod_…).`,
    );
  }
  if (!v.startsWith("price_")) {
    throw new Error(`${lookupSummary} must start with price_.`);
  }
  return v;
}

/** Slug → InternalPlan, derived from the catalog so additions stay in sync. */
export function internalPlanForCrmSlug(plan: PlanSlug): InternalPlan {
  return PLANS[plan].internalPlan;
}
