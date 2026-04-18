import { NextResponse } from "next/server";
import { getCurrentUserWithRole } from "@/lib/auth/getCurrentUser";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendOutboundSms } from "@/lib/ai-sms/outbound";

export const runtime = "nodejs";

function withOptOutFooter(message: string) {
  const m = String(message ?? "").trim();
  if (/reply\s+stop\s+to\s+unsubscribe/i.test(m)) return m;
  return `${m} Reply STOP to unsubscribe.`;
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUserWithRole(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const role = String(user.role ?? "").toLowerCase();
    const isAdmin = role === "admin";
    if (!isAdmin && !user.hasAgentRow) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      leadId?: string;
      to?: string;
      body?: string;
    };
    const leadId = String(body.leadId ?? "").trim();
    const to = String(body.to ?? "").trim();
    const text = String(body.body ?? "").trim();
    if (!leadId || !to || !text) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    const { data: lead, error: leadErr } = await supabaseAdmin
      .from("contacts")
      .select("id,agent_id")
      .eq("id", leadId)
      .maybeSingle();
    if (leadErr) throw leadErr;
    if (!lead) {
      return NextResponse.json({ success: false, error: "Lead not found" }, { status: 404 });
    }

    if (!isAdmin) {
      const { data: agentRow } = await supabaseAdmin
        .from("agents")
        .select("id")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      const myAgentId = agentRow?.id != null ? String(agentRow.id) : null;
      const leadAgentId = lead.agent_id != null ? String(lead.agent_id) : null;
      if (!myAgentId || myAgentId !== leadAgentId) {
        return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
      }
    }

    const { data: prof } = await supabaseAdmin
      .from("user_profiles")
      .select("full_name")
      .eq("user_id", user.id)
      .maybeSingle();
    const actorName = String((prof as { full_name?: string } | null)?.full_name ?? "").trim() || null;

    const { data: agentForLog } = await supabaseAdmin
      .from("agents")
      .select("id")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    const agentIdForSms = agentForLog?.id != null ? String(agentForLog.id) : null;

    const outboundBody = withOptOutFooter(text);
    const sent = await sendOutboundSms({
      leadId,
      to,
      body: outboundBody,
      agentId: agentIdForSms,
      actorType: isAdmin ? "system" : "agent",
      actorName: actorName ?? (isAdmin ? "LeadSmart AI" : "Agent"),
    });

    return NextResponse.json({ success: true, sent });
  } catch (error) {
    console.error("ai-sms send error:", error);
    const msg = error instanceof Error ? error.message : "Failed to send SMS";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
