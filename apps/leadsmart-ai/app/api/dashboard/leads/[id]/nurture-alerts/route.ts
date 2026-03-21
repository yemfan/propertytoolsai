import { NextResponse } from "next/server";
import { supabaseServerClient } from "@/lib/supabaseServerClient";
import { getCurrentAgentContext } from "@/lib/dashboardService";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id: leadId } = await ctx.params;
    const { agentId } = await getCurrentAgentContext();

    const supabase = supabaseServerClient();
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr) throw userErr;
    if (!userData.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    // Enforce access: lead must belong to the current agent.
    const { data: leadRow } = await supabase
      .from("leads")
      .select("id")
      .eq("id", leadId)
      .eq("agent_id", agentId)
      .maybeSingle();

    if (!leadRow) {
      return NextResponse.json({ ok: true, alerts: [] });
    }

    const { data, error } = await supabase
      .from("nurture_alerts")
      .select("id,type,message,created_at")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) throw error;

    return NextResponse.json({ ok: true, alerts: data ?? [] });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}

