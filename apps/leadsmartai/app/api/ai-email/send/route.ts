import { NextResponse } from "next/server";
import { getCurrentUserWithRole } from "@/lib/auth/getCurrentUser";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendOutboundEmail } from "@/lib/ai-email/send";

export const runtime = "nodejs";

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
      subject?: string;
      body?: string;
    };
    const leadId = String(body.leadId ?? "").trim();
    const to = String(body.to ?? "").trim();
    const subject = String(body.subject ?? "").trim();
    const text = String(body.body ?? "").trim();
    if (!leadId || !to || !subject || !text) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    const { data: lead, error: leadErr } = await supabaseAdmin
      .from("leads")
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
    const actorName =
      String((prof as { full_name?: string } | null)?.full_name ?? "").trim() || null;

    const { data: agentForLog } = await supabaseAdmin
      .from("agents")
      .select("id")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    const agentIdForLog = agentForLog?.id != null ? String(agentForLog.id) : null;

    const sent = await sendOutboundEmail({
      leadId,
      to,
      subject,
      body: text,
      agentId: agentIdForLog,
      actorType: isAdmin ? "system" : "agent",
      actorName: actorName ?? (isAdmin ? "LeadSmart" : "Agent"),
      deliver: true,
    });

    return NextResponse.json({ success: true, sent });
  } catch (error) {
    console.error("ai-email send error:", error);
    const msg = error instanceof Error ? error.message : "Failed to send email";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
