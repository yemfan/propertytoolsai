import { NextResponse } from "next/server";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";

/**
 * Agent posts a message visible in the client portal chat for this lead.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getCurrentAgentContext();
    const { id: leadId } = await params;
    const body = await req.json().catch(() => ({}));
    const text = String((body as { body?: string }).body ?? "").trim();
    if (!text) {
      return NextResponse.json({ ok: false, message: "body required" }, { status: 400 });
    }

    const { data: lead, error: leadErr } = await supabaseServer
      .from("leads")
      .select("id,agent_id")
      .eq("id", leadId as any)
      .maybeSingle();

    if (leadErr || !lead) {
      return NextResponse.json({ ok: false, message: "Lead not found" }, { status: 404 });
    }

    if (String((lead as any).agent_id) !== String(ctx.agentId)) {
      return NextResponse.json({ ok: false, message: "Forbidden" }, { status: 403 });
    }

    const { data, error } = await supabaseServer
      .from("client_portal_messages")
      .insert({
        lead_id: leadId as any,
        sender_role: "agent",
        sender_auth_user_id: ctx.userId,
        body: text,
      } as any)
      .select("id,sender_role,body,created_at")
      .single();

    if (error) {
      console.error("client-chat agent POST", error);
      return NextResponse.json({ ok: false, message: "Database error" }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      message: {
        id: String((data as any).id),
        role: "agent",
        body: String((data as any).body),
        created_at: String((data as any).created_at),
      },
    });
  } catch (e: any) {
    if (e?.message === "Not authenticated") {
      return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
    }
    console.error(e);
    return NextResponse.json({ ok: false, message: "Server error" }, { status: 500 });
  }
}
