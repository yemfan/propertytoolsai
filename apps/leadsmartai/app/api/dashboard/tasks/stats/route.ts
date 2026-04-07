import { NextResponse } from "next/server";
import { supabaseServerClient } from "@/lib/supabaseServerClient";
import { supabaseServer } from "@/lib/supabaseServer";

export async function GET() {
  try {
    const supabase = supabaseServerClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const { data: agent } = await supabase.from("agents").select("id").eq("auth_user_id", userData.user.id).maybeSingle();
    if (!agent?.id) return NextResponse.json({ ok: false, error: "Agent not found" }, { status: 403 });

    const agentId = String(agent.id);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();

    // Fetch tasks from last 30 days
    const { data: recentTasks } = await supabaseServer
      .from("crm_tasks")
      .select("id, status, due_at, completed_at, created_at")
      .eq("agent_id", agentId)
      .gte("created_at", thirtyDaysAgo)
      .limit(2000);

    const tasks = (recentTasks ?? []) as Array<{
      id: string;
      status: string;
      due_at: string | null;
      completed_at: string | null;
      created_at: string;
    }>;

    const now = Date.now();
    let ontime = 0;
    let deferred = 0;
    let unfinished = 0;

    for (const t of tasks) {
      if (t.status === "done") {
        // On time: completed before or on due date (or no due date)
        if (!t.due_at || !t.completed_at || new Date(t.completed_at).getTime() <= new Date(t.due_at).getTime()) {
          ontime++;
        } else {
          deferred++; // Completed but after due date
        }
      } else if (t.status === "open") {
        if (t.due_at && new Date(t.due_at).getTime() < now) {
          deferred++; // Overdue and still open
        } else {
          unfinished++; // Not yet due or no due date
        }
      } else {
        // cancelled
        unfinished++;
      }
    }

    // Total performed in 30 days
    const performed = tasks.filter((t) => t.status === "done").length;

    // Tasks completed per day (last 30 days)
    const dailyCounts: Record<string, number> = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86_400_000);
      const key = d.toISOString().slice(0, 10);
      dailyCounts[key] = 0;
    }
    for (const t of tasks) {
      if (t.status === "done" && t.completed_at) {
        const key = new Date(t.completed_at).toISOString().slice(0, 10);
        if (key in dailyCounts) dailyCounts[key]++;
      }
    }
    const performedByDay = Object.entries(dailyCounts).map(([date, count]) => ({
      date,
      label: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      count,
    }));

    return NextResponse.json({
      ok: true,
      completion: [
        { name: "On time", value: ontime, color: "#22c55e" },
        { name: "Deferred", value: deferred, color: "#f59e0b" },
        { name: "Unfinished", value: unfinished, color: "#e5e7eb" },
      ],
      performedByDay,
      performed,
      total: tasks.length,
    });
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Server error" }, { status: 500 });
  }
}
