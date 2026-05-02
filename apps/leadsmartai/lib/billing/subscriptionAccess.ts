import { NextResponse } from "next/server";
import { hasFeature, PLANS, type PlanFeature, type PlanSlug } from "@/lib/billing/plans";
import type { LimitReason } from "@/lib/entitlements/types";
import { supabaseAdmin } from "@/lib/supabase/admin";

const PAID_STATUSES = ["active", "trialing"] as const;

function isPlanSlug(v: string): v is PlanSlug {
  return v === "starter" || v === "pro" || v === "premium" || v === "team";
}

/**
 * Latest **paid** CRM subscription for this user.
 *
 * Two-source lookup:
 *   1. `public.subscriptions` — the legacy Stripe webhook table.
 *      Rarely populated on accounts that signed up via the agent
 *      flow (the new `agent_entitlements` system replaced it).
 *   2. `public.agents.plan_type` — the canonical post-rename source.
 *      Every active agent has a plan_type set on signup (default
 *      "starter" / "free"), even on free trials. We map the agent
 *      plan to the legacy `PlanSlug` so the rest of the gating code
 *      can stay table-agnostic.
 *
 * Returning `null` means "no plan at all" — typically a brand-new
 * user mid-onboarding without an `agents` row yet.
 */
export async function getActiveCrmSubscription(userId: string): Promise<{
  plan: PlanSlug;
  status: string;
} | null> {
  const { data, error } = await supabaseAdmin
    .from("subscriptions")
    .select("plan, status, updated_at")
    .eq("user_id", userId)
    .in("status", [...PAID_STATUSES])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (data) {
    const p = String((data as { plan: unknown }).plan ?? "");
    if (isPlanSlug(p)) {
      return { plan: p, status: String((data as { status: unknown }).status ?? "") };
    }
  }

  // Fallback: read the agent's plan_type. Maps the new agent plans
  // (free / starter / pro / growth / elite / premium / team) onto
  // the legacy CRM slugs (starter | pro | team).
  const { data: agentRow, error: agentErr } = await supabaseAdmin
    .from("agents")
    .select("plan_type")
    .eq("auth_user_id", userId)
    .maybeSingle();
  if (agentErr) throw agentErr;
  const planType = String((agentRow as { plan_type?: unknown } | null)?.plan_type ?? "")
    .toLowerCase()
    .trim();
  const mapped = mapAgentPlanToCrmSlug(planType);
  if (!mapped) return null;
  return { plan: mapped, status: "active" };
}

/**
 * Maps the agent-side plan ids onto the catalog `PlanSlug` so feature
 * flags in `PLANS[...]` resolve correctly. After the catalog rename
 * the mapping is mostly identity, with two legacy aliases:
 *
 *   - `growth` (old name for $49 paid tier) → `pro`
 *   - `elite`  (old name for $99 paid tier) → `premium`
 *
 * Free / Starter both land on `starter` (the new free tier), so any
 * historical row that recorded the entry tier as either name is
 * still gated correctly.
 */
function mapAgentPlanToCrmSlug(planType: string): PlanSlug | null {
  switch (planType) {
    case "free":
    case "starter":
      return "starter";
    case "pro":
    case "growth":
      return "pro";
    case "premium":
    case "elite":
      return "premium";
    case "team":
      return "team";
    default:
      return null;
  }
}

export async function userHasCrmFeature(userId: string, feature: PlanFeature | string): Promise<boolean> {
  const sub = await getActiveCrmSubscription(userId);
  if (!sub) return false;
  return hasFeature({ plan: sub.plan }, feature);
}

export async function getCrmSubscriptionSnapshot(userId: string): Promise<{
  plan: PlanSlug;
  status: string;
  features: readonly string[];
  tier: (typeof PLANS)[PlanSlug];
} | null> {
  const sub = await getActiveCrmSubscription(userId);
  if (!sub) return null;
  return {
    plan: sub.plan,
    status: sub.status,
    features: PLANS[sub.plan].features,
    tier: PLANS[sub.plan],
  };
}

const DEFAULT_LIMIT_REASON: LimitReason = "no_agent_entitlement";

export function subscriptionRequiredResponse(feature: string, limitReason: LimitReason = DEFAULT_LIMIT_REASON) {
  return NextResponse.json(
    {
      ok: false,
      error:
        limitReason === "ai_usage_limit_reached"
          ? "You’ve reached your monthly AI usage on this plan. Upgrade for more."
          : "An active subscription is required for this feature.",
      code: "SUBSCRIPTION_REQUIRED",
      feature,
      limitReason,
      billingPath: "/dashboard/billing",
    },
    { status: 402 }
  );
}

/**
 * Absolute URL for mobile / external clients to open the web billing page (hosted checkout + portal).
 */
export function billingPageAbsoluteUrl(): string | null {
  const base = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  return base ? `${base}/dashboard/billing` : null;
}
