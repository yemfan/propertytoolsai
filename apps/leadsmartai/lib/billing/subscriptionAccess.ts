import { NextResponse } from "next/server";
import { hasFeature, PLANS, type PlanFeature, type PlanSlug } from "@/lib/billing/plans";
import type { LimitReason } from "@/lib/entitlements/types";
import { supabaseAdmin } from "@/lib/supabase/admin";

const PAID_STATUSES = ["active", "trialing"] as const;

function isPlanSlug(v: string): v is PlanSlug {
  return v === "starter" || v === "pro" || v === "team";
}

/**
 * Latest **paid** CRM subscription row from `public.subscriptions` (Stripe webhook / checkout sync).
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
  if (!data) return null;

  const p = String((data as { plan: unknown }).plan ?? "");
  if (!isPlanSlug(p)) return null;

  return { plan: p, status: String((data as { status: unknown }).status ?? "") };
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
