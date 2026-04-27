import { NextResponse } from "next/server";

import { topLikelyBuyersForAgent } from "@/lib/buyerPrediction/service";
import { subscriptionRequiredResponse, userHasCrmFeature } from "@/lib/billing/subscriptionAccess";
import { supabaseServerClient } from "@/lib/supabaseServerClient";

export const runtime = "nodejs";

/**
 * GET — top likely-buyers for the authenticated agent. Mirrors the shape
 * of /api/dashboard/sphere/likely-sellers — same cohort, different score.
 *
 * Query:
 *   limit     default 25, max 100
 *   minScore  default 0
 *   label     low | medium | high
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

    const buyers = await topLikelyBuyersForAgent(agentId, {
      limit: Number.isFinite(limit) ? limit : 25,
      minScore: Number.isFinite(minScore) ? minScore : 0,
      label,
    });

    return NextResponse.json({
      ok: true,
      buyers,
      meta: {
        limit: Number.isFinite(limit) ? limit : 25,
        minScore: Number.isFinite(minScore) ? minScore : 0,
        label: label ?? null,
        note: "Scores are rules-based; see lib/buyerPrediction/computeScore.ts for factor weights.",
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
