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

    // Open house leads (source = "Open House")
    const { data: ohLeads } = await supabaseServer
      .from("leads")
      .select("id, name, email, phone, property_address, rating, created_at")
      .eq("agent_id", agentId)
      .eq("source", "Open House")
      .limit(2000);

    const leads = (ohLeads ?? []) as Array<{
      id: string;
      name: string | null;
      email: string | null;
      property_address: string | null;
      rating: string | null;
      created_at: string;
    }>;

    // Rating breakdown (last 30 days)
    const recentLeads = leads.filter((l) => new Date(l.created_at).getTime() >= Date.now() - 30 * 86_400_000);
    const ratingCounts = { hot: 0, warm: 0, cold: 0 };
    for (const l of recentLeads) {
      const r = String(l.rating ?? "").toLowerCase();
      if (r === "hot") ratingCounts.hot++;
      else if (r === "cold") ratingCounts.cold++;
      else ratingCounts.warm++;
    }

    // Attendance by day (last 30 days)
    const dailyCounts: Record<string, number> = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86_400_000);
      dailyCounts[d.toISOString().slice(0, 10)] = 0;
    }
    for (const l of recentLeads) {
      const key = new Date(l.created_at).toISOString().slice(0, 10);
      if (key in dailyCounts) dailyCounts[key]++;
    }
    const attendanceByDay = Object.entries(dailyCounts).map(([date, count]) => ({
      date,
      label: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      count,
    }));

    // Past open houses grouped by property address
    const openHouseMap = new Map<string, { address: string; visitors: number; leads: number; firstDate: string; lastDate: string }>();
    for (const l of leads) {
      const addr = l.property_address ?? "Unknown";
      const existing = openHouseMap.get(addr);
      if (existing) {
        existing.visitors++;
        existing.leads++;
        if (l.created_at < existing.firstDate) existing.firstDate = l.created_at;
        if (l.created_at > existing.lastDate) existing.lastDate = l.created_at;
      } else {
        openHouseMap.set(addr, {
          address: addr,
          visitors: 1,
          leads: 1,
          firstDate: l.created_at,
          lastDate: l.created_at,
        });
      }
    }
    const pastOpenHouses = Array.from(openHouseMap.values())
      .sort((a, b) => new Date(b.lastDate).getTime() - new Date(a.lastDate).getTime());

    return NextResponse.json({
      ok: true,
      rating: [
        { name: "Hot", value: ratingCounts.hot, color: "#ef4444" },
        { name: "Warm", value: ratingCounts.warm, color: "#f59e0b" },
        { name: "Cold", value: ratingCounts.cold, color: "#6b7280" },
      ],
      attendanceByDay,
      pastOpenHouses,
      totalLeads: leads.length,
      recentLeads: recentLeads.length,
    });
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Server error" }, { status: 500 });
  }
}
