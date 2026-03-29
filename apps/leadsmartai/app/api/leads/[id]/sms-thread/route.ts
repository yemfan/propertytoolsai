import { NextResponse } from "next/server";
import { supabaseServerClient } from "@/lib/supabaseServerClient";
import { getCurrentAgentContext } from "@/lib/dashboardService";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: leadId } = await ctx.params;
    const { agentId } = await getCurrentAgentContext();

    const supabase = supabaseServerClient();

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr) throw userErr;
    if (!userData.user) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const { data: leadRow, error: leadErr } = await supabase
      .from("leads")
      .select("id")
      .eq("id", leadId)
      .eq("agent_id", agentId)
      .maybeSingle();
    if (leadErr) throw leadErr;
    if (!leadRow) {
      return NextResponse.json({ success: true, messages: [] });
    }

    const { data: messageRows, error: msgErr } = await supabase
      .from("sms_messages")
      .select("id,message,direction,created_at")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: true })
      .limit(200);
    if (msgErr) throw msgErr;

    return NextResponse.json({
      success: true,
      messages: messageRows ?? [],
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
