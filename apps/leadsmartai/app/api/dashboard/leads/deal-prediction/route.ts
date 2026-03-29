import { NextResponse } from "next/server";
import { subscriptionRequiredResponse, userHasCrmFeature } from "@/lib/billing/subscriptionAccess";
import { supabaseServerClient } from "@/lib/supabaseServerClient";
import { listHighProbabilityLeads } from "@/lib/dealPrediction/service";

export const runtime = "nodejs";

/**
 * GET — high deal-probability leads for the authenticated agent.
 * Query: minScore (default 70), label=low|medium|high, limit (default 50, max 200)
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const minScoreRaw = url.searchParams.get("minScore");
    const label = url.searchParams.get("label") as "low" | "medium" | "high" | null;
    const limitRaw = url.searchParams.get("limit");

    const supabase = supabaseServerClient();
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr) throw userErr;
    if (!userData.user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
    }

    if (!(await userHasCrmFeature(userData.user.id, "prediction"))) {
      return subscriptionRequiredResponse("prediction", "crm_prediction_locked");
    }

    const { data: agentRow } = await supabase
      .from("agents")
      .select("id")
      .eq("auth_user_id", userData.user.id)
      .maybeSingle();

    const agentId = agentRow?.id != null ? String(agentRow.id) : null;
    if (agentId == null) {
      return NextResponse.json(
        { ok: false, error: "Complete agent signup before using the CRM.", code: "NO_AGENT_ROW" },
        { status: 403 },
      );
    }

    const minScore = minScoreRaw != null ? Number(minScoreRaw) : 70;
    const limit = limitRaw != null ? Number(limitRaw) : 50;

    const leads = await listHighProbabilityLeads({
      agentId,
      minScore: Number.isFinite(minScore) ? minScore : 70,
      label: label === "low" || label === "medium" || label === "high" ? label : undefined,
      limit: Number.isFinite(limit) ? limit : 50,
    });

    return NextResponse.json({
      ok: true,
      leads,
      meta: {
        minScore: Number.isFinite(minScore) ? minScore : 70,
        windowDays: 90,
        note: "Scores are rules-based; see prediction_factors on each lead row after recompute.",
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
