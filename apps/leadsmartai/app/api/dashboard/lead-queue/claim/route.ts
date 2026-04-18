import { NextResponse } from "next/server";
import { supabaseServerClient } from "@/lib/supabaseServerClient";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  try {
    const supabase = supabaseServerClient();
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
    }

    const { data: agent } = await supabase
      .from("agents")
      .select("id")
      .eq("auth_user_id", userData.user.id)
      .maybeSingle();

    if (!agent?.id) {
      return NextResponse.json({ ok: false, error: "Agent not found" }, { status: 403 });
    }

    const agentId = String(agent.id);
    const body = (await req.json().catch(() => ({}))) as { leadId?: string };
    const leadId = String(body.leadId ?? "").trim();

    if (!leadId) {
      return NextResponse.json({ ok: false, error: "leadId is required" }, { status: 400 });
    }

    // Atomic claim: only succeeds if agent_id is still null (first-come-first-served).
    const { data, error } = await supabaseAdmin
      .from("contacts")
      .update({
        agent_id: agentId,
        claimed_at: new Date().toISOString(),
      } as Record<string, unknown>)
      .eq("id", leadId)
      .is("agent_id", null)
      .select("id")
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return NextResponse.json(
        { ok: false, error: "Lead already claimed" },
        { status: 409 }
      );
    }

    return NextResponse.json({ ok: true, leadId: data.id });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}
