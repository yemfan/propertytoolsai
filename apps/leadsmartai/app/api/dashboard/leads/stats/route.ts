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

    const { data: leads } = await supabaseServer
      .from("contacts")
      .select("id, lead_status, source, created_at")
      .eq("agent_id", String(agent.id))
      .limit(5000);

    const rows = (leads ?? []) as Array<{
      id: string;
      lead_status: string | null;
      source: string | null;
      created_at: string;
    }>;

    // Status breakdown
    const statusMap: Record<string, number> = { closed: 0, abandoned: 0, in_progress: 0 };
    for (const r of rows) {
      const s = String(r.lead_status ?? "").toLowerCase();
      if (s === "closed" || s === "won" || s === "sold") statusMap.closed++;
      else if (s === "lost" || s === "abandoned" || s === "dead" || s === "cancelled") statusMap.abandoned++;
      else statusMap.in_progress++; // new, contacted, qualified, etc.
    }

    // Source breakdown
    const sourceCounts: Record<string, number> = {};
    for (const r of rows) {
      const src = String(r.source ?? "unknown").trim() || "unknown";
      sourceCounts[src] = (sourceCounts[src] ?? 0) + 1;
    }
    const SOURCE_COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#6b7280", "#14b8a6"];
    const bySource = Object.entries(sourceCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, value], i) => ({ name, value, color: SOURCE_COLORS[i % SOURCE_COLORS.length] }));

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
      status: [
        { name: "In progress", value: statusMap.in_progress, color: "#3b82f6" },
        { name: "Closed", value: statusMap.closed, color: "#22c55e" },
        { name: "Abandoned", value: statusMap.abandoned, color: "#ef4444" },
      ],
      bySource,
      growth,
      total: rows.length,
    });
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Server error" }, { status: 500 });
  }
}
