import { countAiUsageTodayUtc } from "@/lib/ai/usage";

export type PlanTier = "free" | "pro" | "premium";

export function normalizePlanType(raw: string | null | undefined): PlanTier {
  const p = String(raw ?? "free").toLowerCase();
  if (p === "premium" || p === "elite") return "premium";
  if (p === "pro") return "pro";
  return "free";
}

export function getDailyLimitForPlan(plan: PlanTier): number | null {
  if (plan === "premium") return null;
  if (plan === "pro") return 100;
  return 10;
}

export type RateLimitResult =
  | { ok: true; usedToday: number; limit: number | null }
  | { ok: false; usedToday: number; limit: number; message: string };

/**
 * Enforce per-user daily AI call limits (UTC day).
 * Premium / elite: unlimited (limit null).
 */
export async function assertAiRateLimit(userId: string, planType: string): Promise<RateLimitResult> {
  const plan = normalizePlanType(planType);
  const limit = getDailyLimitForPlan(plan);
  if (limit === null) {
    return { ok: true, usedToday: 0, limit: null };
  }

  const usedToday = await countAiUsageTodayUtc(userId);
  if (usedToday >= limit) {
    return {
      ok: false,
      usedToday,
      limit,
      message: `Daily AI limit reached (${limit}/day for ${plan} plan). Upgrade for more.`,
    };
  }
  return { ok: true, usedToday, limit };
}
