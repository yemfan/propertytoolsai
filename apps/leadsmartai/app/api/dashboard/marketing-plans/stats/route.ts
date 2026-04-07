import { NextResponse } from "next/server";
import { supabaseServerClient } from "@/lib/supabaseServerClient";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const supabase = supabaseServerClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const { data: agent } = await supabase.from("agents").select("id").eq("auth_user_id", userData.user.id).maybeSingle();
    if (!agent?.id) return NextResponse.json({ ok: false, error: "Agent not found" }, { status: 403 });

    const agentId = agent.id;

    // All plans for this agent
    const { data: allPlans } = await supabaseAdmin
      .from("marketing_plans")
      .select("id, status, created_at, completed_at, updated_at")
      .eq("agent_id", agentId)
      .limit(2000);

    const plans = (allPlans ?? []) as Array<{
      id: string;
      status: string;
      created_at: string;
      completed_at: string | null;
      updated_at: string;
    }>;

    // 30-day performance pie
    const thirtyDaysAgo = Date.now() - 30 * 86_400_000;
    const recent = plans.filter((p) => new Date(p.updated_at).getTime() >= thirtyDaysAgo);

    let completed = 0;
    let asPlanned = 0; // active and on track
    let dropped = 0;
    let delayed = 0; // paused

    for (const p of recent) {
      if (p.status === "completed") completed++;
      else if (p.status === "active" || p.status === "approved") asPlanned++;
      else if (p.status === "cancelled") dropped++;
      else if (p.status === "paused") delayed++;
      // draft doesn't count
    }

    // Completed plans by month (last 12 months)
    const monthCounts: Record<string, number> = {};
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthCounts[key] = 0;
    }
    for (const p of plans) {
      if (p.status !== "completed" || !p.completed_at) continue;
      const d = new Date(p.completed_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (key in monthCounts) monthCounts[key]++;
    }

    const completedByMonth = Object.entries(monthCounts).map(([month, count]) => ({
      month,
      label: new Date(month + "-01").toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
      count,
    }));

    return NextResponse.json({
      ok: true,
      performance: [
        { name: "Completed", value: completed, color: "#22c55e" },
        { name: "As planned", value: asPlanned, color: "#3b82f6" },
        { name: "Dropped", value: dropped, color: "#ef4444" },
        { name: "Delayed", value: delayed, color: "#f59e0b" },
      ],
      completedByMonth,
      totalPlans: plans.length,
    });
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Server error" }, { status: 500 });
  }
}
