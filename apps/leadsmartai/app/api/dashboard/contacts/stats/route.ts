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

    // Fetch all leads for this agent (bounded)
    const { data: leads } = await supabaseServer
      .from("leads")
      .select("id, rating, last_contacted_at, created_at")
      .eq("agent_id", agentId)
      .limit(5000);

    const rows = (leads ?? []) as Array<{
      id: string;
      rating: string | null;
      last_contacted_at: string | null;
      created_at: string;
    }>;

    // Rating breakdown
    const ratingCounts: Record<string, number> = { hot: 0, warm: 0, cold: 0 };
    for (const r of rows) {
      const rat = String(r.rating ?? "").toLowerCase();
      if (rat === "hot" || rat === "warm" || rat === "cold") ratingCounts[rat]++;
      else ratingCounts["warm"]++; // default unrated to warm
    }

    // Last Contacted breakdown
    const now30 = Date.now() - 30 * 86_400_000;
    const now6m = Date.now() - 180 * 86_400_000;
    const now1y = Date.now() - 365 * 86_400_000;
    const lastContacted = { within30d: 0, within6m: 0, within1y: 0, over1y: 0, never: 0 };
    for (const r of rows) {
      if (!r.last_contacted_at) { lastContacted.never++; continue; }
      const t = new Date(r.last_contacted_at).getTime();
      if (t >= now30) lastContacted.within30d++;
      else if (t >= now6m) lastContacted.within6m++;
      else if (t >= now1y) lastContacted.within1y++;
      else lastContacted.over1y++;
    }

    // Growth by month (last 12 months)
    const monthCounts: Record<string, number> = {};
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthCounts[key] = 0;
    }
    for (const r of rows) {
      const d = new Date(r.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (key in monthCounts) monthCounts[key]++;
    }

    const growth = Object.entries(monthCounts).map(([month, count]) => ({
      month,
      label: new Date(month + "-01").toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
      count,
    }));

    return NextResponse.json({
      ok: true,
      rating: [
        { name: "Hot", value: ratingCounts.hot, color: "#ef4444" },
        { name: "Warm", value: ratingCounts.warm, color: "#f59e0b" },
        { name: "Cold", value: ratingCounts.cold, color: "#6b7280" },
      ],
      lastContacted: [
        { name: "Last 30 days", value: lastContacted.within30d, color: "#22c55e" },
        { name: "6 months", value: lastContacted.within6m, color: "#3b82f6" },
        { name: "1 year", value: lastContacted.within1y, color: "#f59e0b" },
        { name: "Over 1 year", value: lastContacted.over1y, color: "#ef4444" },
        { name: "Never", value: lastContacted.never, color: "#e5e7eb" },
      ],
      growth,
      total: rows.length,
    });
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Server error" }, { status: 500 });
  }
}
