import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { getUserFromRequest } from "@/lib/authFromRequest";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
    }

    const { count: availableCount, error: availableErr } = await supabaseServer
      .from("opportunities")
      .select("id", { count: "exact", head: true })
      .eq("status", "available");
    if (availableErr) throw availableErr;

    const { count: soldCount, error: soldErr } = await supabaseServer
      .from("opportunities")
      .select("id", { count: "exact", head: true })
      .eq("status", "sold");
    if (soldErr) throw soldErr;

    const { data: soldRevenueRow, error: soldRevenueErr } = await supabaseServer
      .from("opportunities")
      .select("sum(price) as revenue")
      .eq("status", "sold")
      .maybeSingle();

    if (soldRevenueErr) throw soldRevenueErr;

    const soldRevenue = Number((soldRevenueRow as any)?.revenue ?? 0);

    const total = Number(availableCount ?? 0) + Number(soldCount ?? 0);
    const conversionRate = total > 0 ? Number(soldCount ?? 0) / total : 0;
    const revenuePerLead =
      Number(soldCount ?? 0) > 0 ? soldRevenue / Number(soldCount ?? 0) : 0;

    // Tool usage frequency (last 30 days)
    // (We do lightweight counting in JS to avoid DB aggregation syntax drift.)
    const { data: toolUsageRows, error: toolUsageErr } = await supabaseServer
      .from("tool_usage_logs")
      .select("tool_name")
      .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .order("created_at", { ascending: false })
      .limit(5000);
    if (toolUsageErr) throw toolUsageErr;

    const toolUsageSummary = (toolUsageRows ?? []).reduce((acc, row) => {
      const key = String((row as any)?.tool_name ?? "unknown");
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return NextResponse.json({
      ok: true,
      metrics: {
        availableCount: Number(availableCount ?? 0),
        soldCount: Number(soldCount ?? 0),
        conversionRate,
        revenuePerLead,
        soldRevenue,
        toolUsageSummary,
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}

