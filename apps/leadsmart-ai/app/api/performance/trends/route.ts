import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { getUserFromRequest } from "@/lib/authFromRequest";

async function getAgentIdForUser(userId: string) {
  try {
    const { data: agent } = await supabaseServer
      .from("agents")
      .select("id,auth_user_id")
      .eq("auth_user_id", userId)
      .maybeSingle();
    return (agent as any)?.id ?? null;
  } catch {
    // legacy schema may not have auth_user_id
    return null;
  }
}

function daysAgoIso(days: number) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

export async function GET(req: Request) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
    }
    const agentId = await getAgentIdForUser(user.id);
    if (!agentId) {
      return NextResponse.json({ ok: true, days: [] });
    }

    const sinceIso = daysAgoIso(13); // last 14 days including today

    const [tasksRes, eventsRes] = await Promise.all([
      supabaseServer
        .from("tasks")
        .select("status,updated_at", { count: "exact" })
        .eq("agent_id", agentId)
        .gte("updated_at", sinceIso)
        .limit(1000),
      supabaseServer
        .from("lead_events")
        .select("event_type,created_at")
        .gte("created_at", sinceIso)
        .limit(2000),
    ]);

    const tasks = (tasksRes.data as any[]) ?? [];
    const events = (eventsRes.data as any[]) ?? [];

    const map: Record<
      string,
      { tasksDone: number; tasksSkipped: number; engagementEvents: number }
    > = {};

    function dayKey(iso: string) {
      return iso.slice(0, 10);
    }

    for (const t of tasks) {
      const key = dayKey(String(t.updated_at));
      if (!map[key])
        map[key] = { tasksDone: 0, tasksSkipped: 0, engagementEvents: 0 };
      if (t.status === "done") map[key].tasksDone++;
      if (t.status === "skipped") map[key].tasksSkipped++;
    }

    for (const e of events) {
      const key = dayKey(String(e.created_at));
      if (!map[key])
        map[key] = { tasksDone: 0, tasksSkipped: 0, engagementEvents: 0 };
      if (
        e.event_type === "email_open" ||
        e.event_type === "link_click" ||
        e.event_type === "report_view"
      ) {
        map[key].engagementEvents++;
      }
    }

    const days: {
      date: string;
      tasksDone: number;
      tasksSkipped: number;
      engagementEvents: number;
    }[] = [];

    for (let offset = 13; offset >= 0; offset--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - offset);
      const key = d.toISOString().slice(0, 10);
      const row = map[key] ?? {
        tasksDone: 0,
        tasksSkipped: 0,
        engagementEvents: 0,
      };
      days.push({ date: key, ...row });
    }

    return NextResponse.json({ ok: true, days });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}

