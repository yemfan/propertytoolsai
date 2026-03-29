import { recordUsageEvent } from "@/lib/analytics/analyticsEvents";
import { USAGE_EVENT_TYPES } from "@/lib/analytics/eventCatalog";
import { getActiveCrmSubscription } from "@/lib/billing/subscriptionAccess";
import { AI_USAGE_MONTHLY_LIMIT, type PlanSlug } from "@/lib/billing/plans";
import { recordFunnelEvent } from "@/lib/funnel/funnelAnalytics";
import { supabaseAdmin } from "@/lib/supabase/admin";

type RpcResult = {
  allowed?: boolean;
  unlimited?: boolean;
  count?: number;
  limit?: number;
  error?: string;
};

export async function resolveAiMonthlyLimitForUser(userId: string): Promise<number> {
  const sub = await getActiveCrmSubscription(userId);
  if (!sub) {
    return AI_USAGE_MONTHLY_LIMIT.free;
  }
  const plan = sub.plan as PlanSlug;
  return AI_USAGE_MONTHLY_LIMIT[plan] ?? AI_USAGE_MONTHLY_LIMIT.free;
}

function currentUtcMonthStart(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  return `${y}-${String(m).padStart(2, "0")}-01`;
}

/** Pre-flight check without consuming (aligns with `leadsmart_try_consume_ai_credit` month reset). */
export async function peekAiUsageAllowed(userId: string): Promise<boolean> {
  const lim = await resolveAiMonthlyLimitForUser(userId);
  if (lim >= 999999) return true;

  const vMonth = currentUtcMonthStart();
  const { data, error } = await supabaseAdmin
    .from("leadsmart_funnel_state")
    .select("ai_usage_count, ai_usage_month")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) {
    return true;
  }

  const row = data as { ai_usage_count?: number | null; ai_usage_month?: string | null };
  const count = row.ai_usage_month === vMonth ? Number(row.ai_usage_count ?? 0) : 0;
  return count < lim;
}

export type TryConsumeAiCreditOptions = {
  usageMetadata?: Record<string, unknown>;
};

/**
 * Enforces monthly AI caps for free + starter; pro/team are effectively unlimited.
 */
export async function tryConsumeAiCredit(
  userId: string,
  options?: TryConsumeAiCreditOptions
): Promise<{
  allowed: boolean;
  count?: number;
  limit?: number;
}> {
  const { data: prior } = await supabaseAdmin
    .from("leadsmart_funnel_state")
    .select("first_ai_usage_at")
    .eq("user_id", userId)
    .maybeSingle();
  const hadAiBefore = Boolean((prior as { first_ai_usage_at?: string | null } | null)?.first_ai_usage_at);

  const lim = await resolveAiMonthlyLimitForUser(userId);
  const { data, error } = await supabaseAdmin.rpc("leadsmart_try_consume_ai_credit", {
    p_user_id: userId,
    p_monthly_limit: lim,
  });

  if (error) {
    console.error("leadsmart_try_consume_ai_credit", error.message);
    return { allowed: false };
  }

  const row = data as RpcResult | null;
  if (!row || row.error) {
    return { allowed: false };
  }
  if (row.allowed === true) {
    void recordUsageEvent(userId, USAGE_EVENT_TYPES.AI_DRAFT_CONSUMED, {
      ...(options?.usageMetadata ?? {}),
      count: typeof row.count === "number" ? row.count : undefined,
      limit: typeof row.limit === "number" ? row.limit : undefined,
    });
    if (!hadAiBefore) {
      void recordFunnelEvent(userId, "first_ai_usage", { tier: lim >= 999999 ? "unlimited" : "metered" });
    }
    return {
      allowed: true,
      count: typeof row.count === "number" ? row.count : undefined,
      limit: typeof row.limit === "number" ? row.limit : undefined,
    };
  }
  return {
    allowed: false,
    count: typeof row.count === "number" ? row.count : undefined,
    limit: typeof row.limit === "number" ? row.limit : undefined,
  };
}
