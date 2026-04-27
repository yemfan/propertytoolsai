import { NextResponse } from "next/server";

import { subscriptionRequiredResponse, userHasCrmFeature } from "@/lib/billing/subscriptionAccess";
import { fetchLeadSourceRoiForAgent } from "@/lib/leadSourceRoi/service";
import { supabaseServerClient } from "@/lib/supabaseServerClient";

export const runtime = "nodejs";

/**
 * GET — lead-source ROI report for the authenticated agent.
 *
 * Query:
 *   startDate  ISO (inclusive). Defaults to now - 90d.
 *   endDate    ISO (exclusive). Defaults to now.
 *
 * Auth: Supabase session → agents row → agent_id. Entitlement reuses the
 * `prediction` CRM feature gate (same product surface as deal/sphere
 * prediction; the report's value is closing the analytics loop on those).
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const startDateRaw = url.searchParams.get("startDate");
    const endDateRaw = url.searchParams.get("endDate");

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

    // ISO validation: only honor caller-supplied bounds when they parse
    // cleanly. Bad input degrades to defaults rather than 400'ing — the
    // panel sometimes serializes empty-string from the URL on first load.
    const startDate = isValidIso(startDateRaw) ? startDateRaw! : undefined;
    const endDate = isValidIso(endDateRaw) ? endDateRaw! : undefined;

    const report = await fetchLeadSourceRoiForAgent(agentId, { startDate, endDate });

    return NextResponse.json({
      ok: true,
      report,
      meta: {
        windowDays: 90,
        note: "Cohort = contacts whose created_at falls in the window. Won = lifecycle_stage='past_client'.",
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

function isValidIso(v: string | null): boolean {
  if (!v) return false;
  const t = Date.parse(v);
  return Number.isFinite(t);
}
