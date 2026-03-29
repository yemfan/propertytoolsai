import { NextResponse } from "next/server";

import { supabaseServerClient } from "@/lib/supabaseServerClient";

export async function getDashboardAgentContext(): Promise<
  | { ok: true; userId: string; agentId: string; planType: string }
  | { ok: false; response: NextResponse }
> {
  const supabase = supabaseServerClient();
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 }),
    };
  }

  const { data: agent, error: agentErr } = await supabase
    .from("agents")
    .select("id, plan_type")
    .eq("auth_user_id", userData.user.id)
    .maybeSingle();

  if (agentErr) {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, error: "Server error" }, { status: 500 }),
    };
  }

  const agentId = String((agent as { id?: string } | null)?.id ?? "");
  if (!agentId) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: "Complete agent signup before using the CRM.", code: "NO_AGENT_ROW" },
        { status: 403 }
      ),
    };
  }

  const planType = String((agent as { plan_type?: string }).plan_type ?? "free").toLowerCase();
  return { ok: true, userId: userData.user.id, agentId, planType };
}
