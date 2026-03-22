import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/authFromRequest";
import { supabaseServer } from "@/lib/supabaseServer";
import { DEFAULT_LIMITS, resolveAccessTier, type AccessTier } from "@/lib/access";

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
        "plan,subscription_status,estimator_usage_count,cma_usage_count,usage_reset_date"
      )
      .eq("user_id", user.id)
      .maybeSingle();

    if (error && (error as any).code !== "PGRST116") throw error;

    const plan = (data as any)?.plan ?? "free";
    const subscriptionStatus = (data as any)?.subscription_status ?? null;
    const tier: AccessTier = resolveAccessTier({
      userId: user.id,
      plan,
      subscriptionStatus,
    });

    const estimatorUsed = Number((data as any)?.estimator_usage_count ?? 0);
    const cmaUsed = Number((data as any)?.cma_usage_count ?? 0);

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
      usageResetDate: (data as any)?.usage_reset_date ?? null,
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
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Server error" },
      { status: 500 }
    );
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
