import { NextResponse } from "next/server";
import { supabaseServerClient } from "@/lib/supabaseServerClient";
import { getCurrentAgentContext } from "@/lib/dashboardService";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id: leadId } = await ctx.params;
    const { agentId } = await getCurrentAgentContext();
    const supabase = supabaseServerClient();
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr) throw userErr;
    if (!userData.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const body = (await req.json().catch(() => ({}))) as {
      sms_ai_enabled?: boolean;
      sms_agent_takeover?: boolean;
    };
    const payload: any = {};
    if (typeof body.sms_ai_enabled === "boolean") payload.sms_ai_enabled = body.sms_ai_enabled;
    if (typeof body.sms_agent_takeover === "boolean") payload.sms_agent_takeover = body.sms_agent_takeover;
    if (!Object.keys(payload).length) {
      return NextResponse.json(
        { ok: false, error: "sms_ai_enabled or sms_agent_takeover is required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("contacts")
      .update(payload)
      .eq("id", leadId)
      .eq("agent_id", agentId)
      .select("id,sms_ai_enabled,sms_agent_takeover")
      .maybeSingle();
    if (error) throw error;
    return NextResponse.json({ ok: true, lead: data ?? null });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}
