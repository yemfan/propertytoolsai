import { NextResponse } from "next/server";
import { requireRoleRoute } from "@/lib/auth/requireRole";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { insertAgentInboxNotification } from "@/lib/notifications/agentNotifications";

export async function POST(req: Request) {
  try {
    const auth = await requireRoleRoute(["admin", "support"], { strictUnauthorized: true });
    if (auth.ok === false) return auth.response;

    const body = (await req.json().catch(() => ({}))) as {
      leadId?: string;
      agentId?: string;
    };
    const leadId = String(body.leadId ?? "").trim();
    const agentId = String(body.agentId ?? "").trim();

    if (!leadId || !agentId) {
      return NextResponse.json(
        { ok: false, error: "leadId and agentId are required" },
        { status: 400 }
      );
    }

    // Atomic assign: only succeeds if agent_id is still null.
    const { data, error } = await supabaseAdmin
      .from("leads")
      .update({
        agent_id: agentId,
        claimed_at: new Date().toISOString(),
      } as Record<string, unknown>)
      .eq("id", leadId)
      .is("agent_id", null)
      .select("id, name, source")
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return NextResponse.json(
        { ok: false, error: "Lead already assigned" },
        { status: 409 }
      );
    }

    // Notify the assigned agent (best-effort).
    try {
      await insertAgentInboxNotification({
        agentId,
        type: "new_lead",
        priority: "high",
        title: "Lead assigned to you",
        body: `${(data as any).name ?? "A lead"} (${(data as any).source ?? "unknown"}) has been assigned to you.`,
        deepLink: { screen: "lead", leadId },
      });
    } catch (e) {
      console.warn("admin lead-queue assign: notification failed", e);
    }

    return NextResponse.json({ ok: true, leadId: data.id });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}
