import { NextResponse } from "next/server";
import { resolveAiMonthlyLimitForUser } from "@/lib/funnel/aiUsage";
import { getCurrentUserWithRole } from "@/lib/auth/getCurrentUser";
import { getCrmSubscriptionSnapshot, userHasCrmFeature } from "@/lib/billing/subscriptionAccess";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * Lightweight funnel + usage snapshot for dashboard clients (upgrade banners, soft prompts).
 */
export async function GET(_req: Request) {
  try {
    const user = await getCurrentUserWithRole();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const userId = user.id;
    const [sub, limit, automation, prediction, stateRow] = await Promise.all([
      getCrmSubscriptionSnapshot(userId),
      resolveAiMonthlyLimitForUser(userId),
      userHasCrmFeature(userId, "automation"),
      userHasCrmFeature(userId, "prediction"),
      supabaseAdmin.from("leadsmart_funnel_state").select("*").eq("user_id", userId).maybeSingle(),
    ]);

    if (stateRow.error) {
      console.error("leadsmart_funnel_state", stateRow.error.message);
    }

    const row = stateRow.data as
      | {
          onboarding_completed_at?: string | null;
          first_reply_at?: string | null;
          first_ai_usage_at?: string | null;
          ai_usage_month?: string | null;
          ai_usage_count?: number | null;
        }
      | null;

    const aiUsed = Number(row?.ai_usage_count ?? 0);
    const aiLimit = limit >= 999999 ? null : limit;

    return NextResponse.json({
      ok: true,
      onboardingCompleted: Boolean(row?.onboarding_completed_at),
      firstReplyAt: row?.first_reply_at ?? null,
      firstAiUsageAt: row?.first_ai_usage_at ?? null,
      aiUsage: {
        used: aiUsed,
        limit: aiLimit,
        month: row?.ai_usage_month ?? null,
        nearLimit: aiLimit != null && aiUsed >= Math.max(0, aiLimit - 2),
        atLimit: aiLimit != null && aiUsed >= aiLimit,
      },
      crmSubscription: sub,
      gates: {
        automation,
        prediction,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("GET /api/funnel/state", e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
