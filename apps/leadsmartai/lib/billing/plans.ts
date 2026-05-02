import type { InternalPlan } from "./stripe-plan-map";

/**
 * LeadSmart agent plan catalog — single source of truth for the
 * dashboard billing page, the upgrade modal, the marketing pricing
 * page, the Stripe checkout, and entitlement gating.
 *
 * Derived elsewhere (so we don't fork pricing across files):
 *   - `crmStripePrices.ts`     reads `stripePriceEnvVar` per slug
 *   - `stripe-plan-map.ts`     reads `internalPlan` per slug
 *   - `subscriptionAccess.ts`  exposes feature gating via `hasFeature`
 *   - `BillingPageClient.tsx`  renders cards from `displayName` +
 *                              `tagline` + `price` + `features` +
 *                              `popular`
 *
 * Naming aligns with the marketing pricing page (Starter / Pro /
 * Premium / Team — see `apps/leadsmartai/app/agent/pricing/`). The
 * older CRM tier names (`starter` was $49, `pro` was $99) are retired
 * — `starter` is now the free entry tier and `premium` covers the
 * $99 step. Existing `subscriptions.plan='starter'` rows that were
 * paying customers need a one-time migration to `pro` (see PR body).
 */

export type PlanSlug = "starter" | "pro" | "premium" | "team";

export type PlanFeature =
  | "basic_crm"
  | "limited_ai"
  | "full_ai"
  | "automation"
  | "prediction"
  | "multi_agent"
  | "routing"
  | "producer_track_coaching"
  | "top_producer_track_coaching";

export type PlanDefinition = {
  slug: PlanSlug;
  /** Card title on plan cards + dashboard billing page. */
  displayName: string;
  /** One-line subtitle on plan cards. */
  tagline: string;
  /** Monthly price in USD. 0 = free (no Stripe subscription). */
  price: number;
  /** Feature flags — drive both `hasFeature` gating and card bullets. */
  features: readonly PlanFeature[];
  /** Env var holding the Stripe Price ID (`price_…`). Null for free. */
  stripePriceEnvVar: string | null;
  /** Maps to `InternalPlan` for entitlements + analytics. */
  internalPlan: InternalPlan;
  /** Coaching tier label (Producer Track / Top Producer Track), if any. */
  coachingTier?: "Producer Track" | "Top Producer Track";
  /** Highlight this card as "Most popular". */
  popular?: boolean;
};

/**
 * Canonical plan catalog. Edit ONLY here when prices, features, or
 * Stripe env-var names change — every consumer derives from this.
 */
export const PLANS: Record<PlanSlug, PlanDefinition> = {
  starter: {
    slug: "starter",
    displayName: "Starter",
    tagline: "For new agents testing the platform",
    price: 0,
    features: ["basic_crm"],
    stripePriceEnvVar: null,
    internalPlan: "crm_starter",
  },
  pro: {
    slug: "pro",
    displayName: "Pro",
    tagline: "Producer Track coaching + AI drafts",
    price: 49,
    features: ["basic_crm", "limited_ai", "producer_track_coaching"],
    // Reuses the existing STRIPE_PRICE_ID_PRO env var — historically
    // the $49 product was wired to this name (the old "starter" CRM
    // slug also pointed here). Same Stripe product, new slug name.
    stripePriceEnvVar: "STRIPE_PRICE_ID_PRO",
    internalPlan: "crm_pro",
    coachingTier: "Producer Track",
    popular: true,
  },
  premium: {
    slug: "premium",
    displayName: "Premium",
    tagline: "Top Producer Track + full AI",
    price: 99,
    features: [
      "basic_crm",
      "full_ai",
      "automation",
      "prediction",
      "top_producer_track_coaching",
    ],
    // STRIPE_PRICE_ID_PREMIUM with fallback to STRIPE_PRICE_ID_ELITE
    // is handled in crmStripePrices.ts so existing deployments don't
    // need to rename the env var on day one.
    stripePriceEnvVar: "STRIPE_PRICE_ID_PREMIUM",
    internalPlan: "crm_premium",
    coachingTier: "Top Producer Track",
  },
  team: {
    slug: "team",
    displayName: "Team",
    tagline: "Up to 5 seats, multi-agent workspace",
    price: 199,
    features: [
      "basic_crm",
      "full_ai",
      "automation",
      "prediction",
      "multi_agent",
      "routing",
      "top_producer_track_coaching",
    ],
    stripePriceEnvVar: "STRIPE_PRICE_ID_TEAM",
    internalPlan: "crm_team",
    coachingTier: "Top Producer Track",
  },
};

/** Iteration helper — render order on plan cards. */
export const PLAN_SLUGS_IN_ORDER: ReadonlyArray<PlanSlug> = [
  "starter",
  "pro",
  "premium",
  "team",
];

export type PlanFeatureUser = {
  plan?: string | null;
};

function planSlugFromString(s: string): PlanSlug | null {
  if (s in PLANS) return s as PlanSlug;
  return null;
}

/**
 * Whether the user's current tier includes a feature flag from `PLANS`.
 * Unknown or empty `plan` → false (no throw).
 */
export function hasFeature(
  user: PlanFeatureUser,
  feature: PlanFeature | string,
): boolean {
  const raw = user.plan;
  const slug = planSlugFromString(typeof raw === "string" ? raw.trim() : "");
  if (!slug) return false;
  return (PLANS[slug].features as readonly string[]).includes(
    feature as PlanFeature,
  );
}

/**
 * Monthly AI draft generations for capped tiers. `free` is the
 * implicit "no plan" state used by code that reads `plan: null` and
 * needs a tiny default; `starter` matches it (paid name for the same
 * free tier). High caps for Premium / Team are functionally
 * unlimited but kept finite for safety.
 */
export const AI_USAGE_MONTHLY_LIMIT: Record<PlanSlug | "free", number> = {
  free: 100,
  starter: 100,
  pro: 5_000,
  premium: 999_999,
  team: 999_999,
};
