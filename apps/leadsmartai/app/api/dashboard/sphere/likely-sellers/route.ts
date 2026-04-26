import { NextResponse } from "next/server";

import { subscriptionRequiredResponse, userHasCrmFeature } from "@/lib/billing/subscriptionAccess";
import { topLikelySellersForAgent } from "@/lib/spherePrediction/service";
import { supabaseServerClient } from "@/lib/supabaseServerClient";

export const runtime = "nodejs";

/**
 * GET — top likely-sellers for the authenticated agent.
 *
 * Query:
 *   limit     default 25, max 100
 *   minScore  default 0 (no floor)
 *   label     low | medium | high
 *
 * Auth: Supabase session → agents row → agent_id. Mirrors the
 * /api/dashboard/leads/deal-prediction handler so both prediction surfaces
 * stay structurally identical and reviewable side-by-side.
 *
 * Subscription gate: reuses the "prediction" feature flag that already
 * gates dealPrediction. SOI seller-prediction is the same product surface
 * (CRM prediction insights), so we do not introduce a new entitlement key
 * for it — that would split billing in two without a customer-visible reason.
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const limitRaw = url.searchParams.get("limit");
    const minScoreRaw = url.searchParams.get("minScore");
    const labelRaw = url.searchParams.get("label");

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

    const limit = limitRaw != null ? Number(limitRaw) : 25;
    const minScore = minScoreRaw != null ? Number(minScoreRaw) : 0;
    const label =
      labelRaw === "high" || labelRaw === "medium" || labelRaw === "low" ? labelRaw : undefined;

    const sellers = await topLikelySellersForAgent(agentId, {
      limit: Number.isFinite(limit) ? limit : 25,
      minScore: Number.isFinite(minScore) ? minScore : 0,
      label,
    });

    return NextResponse.json({
      ok: true,
      sellers,
      meta: {
        limit: Number.isFinite(limit) ? limit : 25,
        minScore: Number.isFinite(minScore) ? minScore : 0,
        label: label ?? null,
        note: "Scores are rules-based; see lib/spherePrediction/computeScore.ts for factor weights.",
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
