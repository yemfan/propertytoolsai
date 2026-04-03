import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/authFromRequest";
import { supabaseServer } from "@/lib/supabaseServer";
import { DEFAULT_LIMITS, resolveAccessTier, type AccessTier } from "@/lib/access";
import { getPaidSubscriptionEligibility } from "@/lib/paidSubscriptionEligibility";

export const runtime = "nodejs";

/**
 * Unified usage + tier for the client (Auth modal / paywall / tool headers).
 */
export async function GET(req: Request) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json(buildGuestPayload());
    }

    const { data, error } = await supabaseServer
      .from("user_profiles")
      .select(
        "leadsmart_users(plan,subscription_status,estimator_usage_count,cma_usage_count,usage_reset_date,role),propertytools_users(tier,subscription_status)"
      )
      .eq("user_id", user.id)
      .maybeSingle();

    if (error && (error as { code?: string }).code !== "PGRST116") throw error;

    const row = data as {
      leadsmart_users?: Record<string, unknown> | Record<string, unknown>[] | null;
      propertytools_users?: { tier?: string; subscription_status?: string | null } | { tier?: string; subscription_status?: string | null }[] | null;
    } | null;

    const lsRaw = row?.leadsmart_users;
    const ls = lsRaw == null ? null : Array.isArray(lsRaw) ? lsRaw[0] : lsRaw;
    const ptRaw = row?.propertytools_users;
    const pt = ptRaw == null ? null : Array.isArray(ptRaw) ? ptRaw[0] : ptRaw;

    const plan = (ls?.plan as string) ?? "free";
    const lsStatus = ls?.subscription_status != null ? String(ls.subscription_status) : null;
    const ptStatus = pt?.subscription_status != null ? String(pt.subscription_status) : null;
    const subscriptionStatus =
      ptStatus != null && ptStatus.trim() !== "" ? ptStatus : lsStatus;

    const rawRole = String(ls?.role ?? "").toLowerCase().trim();
    const accountRole =
      rawRole === "user" || rawRole === "" ? "consumer" : String(ls?.role ?? "");

    const ptTier = pt?.tier === "premium" || pt?.tier === "basic" ? pt.tier : null;

    const paidElig = await getPaidSubscriptionEligibility(user.id);
    const tier: AccessTier = resolveAccessTier({
      userId: user.id,
      plan,
      subscriptionStatus,
      accountRole,
      propertytoolsTier: ptTier,
    });

    const estimatorUsed = Number(ls?.estimator_usage_count ?? 0);
    const cmaUsed = Number(ls?.cma_usage_count ?? 0);

    const freeEstimatorLimit = DEFAULT_LIMITS.free.estimator.limit ?? 3;
    const freeCmaLimit = DEFAULT_LIMITS.free.cma.limit ?? 1;

    const estimatorLimit =
      tier === "premium" ? null : tier === "guest" ? DEFAULT_LIMITS.guest.estimator.limit : freeEstimatorLimit;
    const cmaLimit =
      tier === "premium" ? null : tier === "guest" ? DEFAULT_LIMITS.guest.cma.limit : freeCmaLimit;

    return NextResponse.json({
      ok: true,
      tier,
      plan,
      subscriptionStatus,
      userId: user.id,
      email: user.email ?? null,
      accountRole,
      paidSubscriptionEligible: paidElig.allowed,
      usageResetDate: (ls?.usage_reset_date as string | null) ?? null,
      tools: {
        estimator: {
          used: estimatorUsed,
          limit: estimatorLimit,
          period: "monthly",
          remaining:
            estimatorLimit === null ? null : Math.max(0, estimatorLimit - estimatorUsed),
        },
        home_value: {
          used: estimatorUsed,
          limit: estimatorLimit,
          period: "monthly",
          remaining:
            estimatorLimit === null ? null : Math.max(0, estimatorLimit - estimatorUsed),
        },
        cma: {
          used: cmaUsed,
          limit: cmaLimit,
          period: "monthly",
          remaining: cmaLimit === null ? null : Math.max(0, cmaLimit - cmaUsed),
        },
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

function buildGuestPayload() {
  return {
    ok: true,
    tier: "guest" as const,
    plan: null,
    subscriptionStatus: null,
    userId: null,
    email: null,
    usageResetDate: null,
    tools: {
      estimator: {
        used: 0,
        limit: DEFAULT_LIMITS.guest.estimator.limit,
        period: "daily",
        remaining: DEFAULT_LIMITS.guest.estimator.limit,
      },
      home_value: {
        used: 0,
        limit: DEFAULT_LIMITS.guest.home_value.limit,
        period: "daily",
        remaining: DEFAULT_LIMITS.guest.home_value.limit,
      },
      cma: {
        used: 0,
        limit: DEFAULT_LIMITS.guest.cma.limit,
        period: "daily",
        remaining: DEFAULT_LIMITS.guest.cma.limit,
      },
      mortgage_calculator: {
        used: 0,
        limit: DEFAULT_LIMITS.guest.mortgage_calculator.limit,
        period: "daily",
        remaining: DEFAULT_LIMITS.guest.mortgage_calculator.limit,
      },
    },
  };
}
