import type { InternalPlan } from "@/lib/billing/stripe-plan-map";
import type { PlanSlug } from "@/lib/billing/plans";

const ENV_KEYS: Record<PlanSlug, string> = {
  starter: "STRIPE_PRICE_ID_CRM_STARTER",
  pro: "STRIPE_PRICE_ID_CRM_PRO",
  team: "STRIPE_PRICE_ID_CRM_TEAM",
};

/**
 * Monthly Stripe Price IDs for LeadSmart CRM tiers (`price_…`).
 */
export function getCrmStripePriceId(plan: PlanSlug): string {
  const envKey = ENV_KEYS[plan];
  const v = (process.env[envKey] ?? "").trim();

  if (!v) {
    throw new Error(
      `Missing ${envKey}. Add a recurring monthly Stripe Price ID for the ${plan} CRM plan.`
    );
  }

  if (v.startsWith("prod_")) {
    throw new Error(
      `${envKey} must be a Price ID (price_…), not a Product ID (prod_…).`
    );
  }

  if (!v.startsWith("price_")) {
    throw new Error(`${envKey} must start with price_.`);
  }

  return v;
}

export function internalPlanForCrmSlug(plan: PlanSlug): InternalPlan {
  switch (plan) {
    case "starter":
      return "crm_starter";
    case "pro":
      return "crm_pro";
    case "team":
      return "crm_team";
  }
}
