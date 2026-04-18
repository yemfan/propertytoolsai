import { NextResponse } from "next/server";
import { supabaseServerClient } from "@/lib/supabaseServerClient";
import { getCurrentAgentContext } from "@/lib/dashboardService";

export const runtime = "nodejs";

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
      .from("contacts")
      .select("id")
      .eq("id", leadId)
      .eq("agent_id", agentId)
      .maybeSingle();
    if (leadErr) throw leadErr;
    if (!leadRow) {
      return NextResponse.json({ success: true, rows: [] });
    }

    const { data: rows, error: hErr } = await supabase
      .from("greeting_message_history")
      .select("id,event_type,holiday_key,channel,subject,body,status,created_at,skipped_reason")
      .eq("contact_id", leadId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (hErr) throw hErr;

    return NextResponse.json({ success: true, rows: rows ?? [] });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
