import { NextResponse } from "next/server";
import { supabaseServerClient } from "@/lib/supabaseServerClient";

export async function GET() {
  try {
    const supabase = supabaseServerClient();
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr) throw userErr;
    if (!userData.user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
    }

    const userId = userData.user.id;

    const { data: agent, error: agentErr } = await supabase
      .from("agents")
      .select("id,plan_type,auth_user_id")
      .eq("auth_user_id", userId)
      .maybeSingle();

    if (agentErr) {
      const msg = String((agentErr as any)?.message ?? agentErr);
      if (/auth_user_id/i.test(msg)) {
        return NextResponse.json({ ok: false, error: "Agent mapping not configured" }, { status: 400 });
      }
      throw agentErr;
    }

    const agentId = String((agent as any)?.id ?? "");
    const planType = String((agent as any)?.plan_type ?? "free").toLowerCase();

    if (!agentId) {
      return NextResponse.json({ ok: true, count: 0, limit: 0, plan: planType });
    }

    // Limits: free=no CRM, pro=500, premium=unlimited
    const limit = planType === "pro" ? 500 : planType === "premium" ? null : 0;

    const { count, error } = await supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("agent_id", agentId);
    if (error) throw error;

    return NextResponse.json({ ok: true, count: count ?? 0, limit, plan: planType });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}

