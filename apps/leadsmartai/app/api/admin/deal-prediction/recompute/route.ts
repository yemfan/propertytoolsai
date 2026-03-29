import { NextResponse } from "next/server";
import { getCurrentUserWithRole } from "@/lib/auth/getCurrentUser";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { recomputeDealPredictionsForAgent } from "@/lib/dealPrediction/service";

export const runtime = "nodejs";

async function agentIdForUser(userId: string) {
  const { data } = await supabaseAdmin.from("agents").select("id").eq("auth_user_id", userId).maybeSingle();
  return data?.id != null ? String(data.id) : null;
}

/**
 * POST — batch recompute deal predictions for the current agent (or all agents if admin + allAgents).
 * Body: { limit?: number } (default 300, max 2000)
 */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUserWithRole(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as { limit?: number; allAgents?: boolean };
    const role = String(user.role ?? "").toLowerCase();
    const runAll = role === "admin" && body.allAgents === true;

    if (runAll) {
      const { data: agents, error } = await supabaseAdmin.from("agents").select("id").limit(500);
      if (error) throw error;
      let processed = 0;
      let errors = 0;
      for (const a of agents ?? []) {
        const agentId = String((a as { id: unknown }).id);
        const r = await recomputeDealPredictionsForAgent(agentId, body.limit ?? 300);
        processed += r.processed;
        errors += r.errors;
      }
      return NextResponse.json({
        success: true,
        scope: "all_agents",
        processed,
        errors,
      });
    }

    const agentId = await agentIdForUser(user.id);
    if (!agentId) {
      return NextResponse.json(
        { success: false, error: "An agent profile is required" },
        { status: 403 },
      );
    }

    const result = await recomputeDealPredictionsForAgent(agentId, body.limit ?? 300);
    return NextResponse.json({
      success: true,
      scope: "single_agent",
      agentId,
      ...result,
    });
  } catch (e) {
    console.error("deal-prediction recompute error:", e);
    return NextResponse.json({ success: false, error: "Failed to recompute predictions" }, { status: 500 });
  }
}
