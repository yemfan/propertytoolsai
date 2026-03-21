import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/adminRole";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import { loadRevenueDashboardData } from "@/lib/revenueKpi/db";
import { generateRevenueInsights } from "@/lib/revenueKpi/insights";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const ctx = await getCurrentAgentContext();
    const forbidden = await requireAdminApi(ctx.userId);
    if (forbidden) return forbidden;

    const body = (await req.json().catch(() => ({}))) as { days?: number };
    const days = Math.max(1, Math.min(366, Number(body.days ?? 30)));

    const data = await loadRevenueDashboardData(ctx.agentId, days);
    const alertMessages = (data.alertsFeed as { message: string }[]).map((a) => a.message);

    const { text, model } = await generateRevenueInsights({
      kpis: data.kpi,
      funnel: data.funnel,
      alertMessages,
    });

    return NextResponse.json({ ok: true, text, model });
  } catch (e: any) {
    if (e?.message === "Not authenticated") {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    console.error("POST /api/dashboard/revenue/insights", e);
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}
