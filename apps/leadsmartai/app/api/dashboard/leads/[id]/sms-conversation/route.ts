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

    // Enforce auth: only authenticated agents can view.
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr) throw userErr;
    if (!userData.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    // Verify lead belongs to agent.
    const { data: leadRow, error: leadErr } = await supabase
      .from("contacts")
      .select("id, rating, nurture_score, sms_ai_enabled, sms_agent_takeover, sms_followup_stage, sms_last_outbound_at, sms_last_inbound_at")
      .eq("id", leadId)
      .eq("agent_id", agentId)
      .maybeSingle();
    if (leadErr) throw leadErr;
    if (!leadRow) return NextResponse.json({ ok: true, conversation: null });

    const { data: convoRow, error: convoErr } = await supabase
      .from("sms_conversations")
      .select("id,stage,messages,last_ai_reply_at,created_at")
      .eq("contact_id", leadId)
      .maybeSingle();
    if (convoErr) throw convoErr;

    const { data: messageRows } = await supabase
      .from("sms_messages")
      .select("id,message,direction,created_at")
      .eq("contact_id", leadId)
      .order("created_at", { ascending: true })
      .limit(200);

    return NextResponse.json({
      ok: true,
      conversation: convoRow ?? null,
      lead: leadRow,
      messages: messageRows ?? [],
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}

