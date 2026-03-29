/**
 * Display / catalog prices for CRM tiers (USD / month).
 * Distinct from `InternalPlan` in `stripe-plan-map.ts` and agent `PLAN_CATALOG` entitlements —
 * wire Stripe price IDs separately when checkout uses these slugs.
 */
export const PLANS = {
  starter: {
    price: 49,
    features: ["basic_crm", "limited_ai"],
  },
  pro: {
    price: 99,
    features: ["full_ai", "automation", "prediction"],
  },
  team: {
    price: 199,
    features: ["multi_agent", "routing"],
  },
} as const;

export type PlanSlug = keyof typeof PLANS;

export type PlanDefinition = (typeof PLANS)[PlanSlug];

/** Monthly AI draft generations (mobile + similar) for capped tiers. Pro/Team pass a high limit in RPC. */
export const AI_USAGE_MONTHLY_LIMIT: Record<PlanSlug | "free", number> = {
  free: 8,
  starter: 35,
  pro: 999_999,
  team: 999_999,
};

/** Every feature flag string declared on any tier in `PLANS`. */
export type PlanFeature = (typeof PLANS)[PlanSlug]["features"][number];

export type PlanFeatureUser = {
  plan?: string | null;
};

function planSlugFromString(s: string): PlanSlug | null {
  if (s in PLANS) return s as PlanSlug;
  return null;
}

/**
 * Whether the user’s current tier includes a feature flag from `PLANS`.
 * Unknown or empty `plan` → false (no throw).
 */
export function hasFeature(user: PlanFeatureUser, feature: PlanFeature | string): boolean {
  const raw = user.plan;
  const slug = planSlugFromString(typeof raw === "string" ? raw.trim() : "");
  if (!slug) return false;
  return (PLANS[slug].features as readonly string[]).includes(feature);
}
