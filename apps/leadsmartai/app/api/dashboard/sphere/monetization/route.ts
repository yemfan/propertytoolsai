import { NextResponse } from "next/server";

import { subscriptionRequiredResponse, userHasCrmFeature } from "@/lib/billing/subscriptionAccess";
import {
  attachEnrollments,
  BOTH_HIGH_CADENCE_KEY,
  listEnrollmentsForAgent,
} from "@/lib/sphereDrip/service";
import { fetchMonetizationViewForAgent } from "@/lib/sphereMonetization/service";
import { supabaseServerClient } from "@/lib/supabaseServerClient";

export const runtime = "nodejs";

/**
 * GET — combined sphere-monetization view for the authenticated agent.
 *
 * One row per contact with seller-side and buyer-side scores side-by-side,
 * sorted by combined score desc. Powers the unified "where's the highest
 * leverage?" surface that answers both directions at once.
 *
 * Query:
 *   limitPerSide   default 100, max 200 (each engine fetches up to N candidates)
 *   minScore       default 0
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const limitRaw = url.searchParams.get("limitPerSide");
    const minScoreRaw = url.searchParams.get("minScore");

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

    const limitPerSide = limitRaw != null ? Number(limitRaw) : 100;
    const minScore = minScoreRaw != null ? Number(minScoreRaw) : 0;

    const [rows, enrollments] = await Promise.all([
      fetchMonetizationViewForAgent(agentId, {
        limitPerSide: Number.isFinite(limitPerSide) ? limitPerSide : 100,
        minScore: Number.isFinite(minScore) ? minScore : 0,
      }),
      // Best-effort — if the drip table is missing or RLS misconfigured we
      // still want the monetization rows to render. Caught + treated as
      // "no enrollments".
      listEnrollmentsForAgent(agentId, BOTH_HIGH_CADENCE_KEY).catch(() => []),
    ]);

    const decoratedRows = attachEnrollments(rows, enrollments);

    return NextResponse.json({
      ok: true,
      rows: decoratedRows,
      meta: {
        limitPerSide: Number.isFinite(limitPerSide) ? limitPerSide : 100,
        minScore: Number.isFinite(minScore) ? minScore : 0,
        cadenceKey: BOTH_HIGH_CADENCE_KEY,
        note: "Combined view joins seller-prediction and buyer-prediction scores by contactId. Each row also carries the agent's drip enrollment state for the both_high cadence.",
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
