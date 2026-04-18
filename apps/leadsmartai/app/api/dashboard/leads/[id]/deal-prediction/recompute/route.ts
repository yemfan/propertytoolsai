import { NextResponse } from "next/server";
import { subscriptionRequiredResponse, userHasCrmFeature } from "@/lib/billing/subscriptionAccess";
import { supabaseServerClient } from "@/lib/supabaseServerClient";
import { recomputeDealPredictionForLead } from "@/lib/dealPrediction/service";

export const runtime = "nodejs";

/**
 * POST — recompute deal prediction for one lead (agent must own the lead).
 */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: leadId } = await ctx.params;
    if (!leadId) {
      return NextResponse.json({ ok: false, error: "id is required" }, { status: 400 });
    }

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

    const { data: lead, error: leadErr } = await supabase
      .from("contacts")
      .select("id,agent_id")
      .eq("id", leadId)
      .maybeSingle();

    if (leadErr) throw leadErr;
    if (!lead || String((lead as { agent_id: unknown }).agent_id) !== agentId) {
      return NextResponse.json({ ok: false, error: "Lead not found" }, { status: 404 });
    }

    const result = await recomputeDealPredictionForLead(leadId);
    if (!result) {
      return NextResponse.json({ ok: false, error: "Lead not found or merged" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, prediction: result });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
