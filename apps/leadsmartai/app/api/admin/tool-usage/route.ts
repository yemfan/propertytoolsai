import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/authFromRequest";
import { supabaseServer } from "@/lib/supabaseServer";

export async function GET(req: Request) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Query events table for tool usage
  const { data: toolUsage } = await supabaseServer
    .from("events")
    .select("event_type, created_at, user_id")
    .like("event_type", "%_used")
    .order("created_at", { ascending: false })
    .limit(5000);

  // Also query tool_events for home value + CMA
  const { data: toolEvents } = await supabaseServer
    .from("tool_events")
    .select("tool_name, event_name, created_at, user_id")
    .order("created_at", { ascending: false })
    .limit(5000);

  // Query leads count
  const { count: leadCount } = await supabaseServer
    .from("leads")
    .select("id", { count: "exact", head: true });

  // Aggregate
  const byTool: Record<string, { total: number; last7d: number; last30d: number }> = {};
  const now = Date.now();
  const d7 = 7 * 86400000;
  const d30 = 30 * 86400000;

  for (const row of toolUsage ?? []) {
    const tool = row.event_type;
    if (!byTool[tool]) byTool[tool] = { total: 0, last7d: 0, last30d: 0 };
    byTool[tool].total++;
    const age = now - new Date(row.created_at).getTime();
    if (age < d7) byTool[tool].last7d++;
    if (age < d30) byTool[tool].last30d++;
  }

  for (const row of toolEvents ?? []) {
    const tool = row.tool_name + "_" + row.event_name;
    if (!byTool[tool]) byTool[tool] = { total: 0, last7d: 0, last30d: 0 };
    byTool[tool].total++;
    const age = now - new Date(row.created_at).getTime();
    if (age < d7) byTool[tool].last7d++;
    if (age < d30) byTool[tool].last30d++;
  }

  // Daily totals for last 30 days
  const daily: Record<string, number> = {};
  for (const row of [...(toolUsage ?? []), ...(toolEvents ?? [])]) {
    const day = new Date(row.created_at).toISOString().slice(0, 10);
    daily[day] = (daily[day] ?? 0) + 1;
  }

  return NextResponse.json({
    ok: true,
    tools: byTool,
    daily,
    leadCount: leadCount ?? 0,
    totalEvents: (toolUsage?.length ?? 0) + (toolEvents?.length ?? 0),
  });
}
