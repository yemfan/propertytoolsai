import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/adminRole";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import { loadRevenueDashboardData } from "@/lib/revenueKpi/db";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const ctx = await getCurrentAgentContext();
    const forbidden = await requireAdminApi(ctx.userId);
    if (forbidden) return forbidden;

    const url = new URL(req.url);
    const days = Math.max(1, Math.min(366, Number(url.searchParams.get("days") ?? "30")));

    const data = await loadRevenueDashboardData(ctx.agentId, days);

    return NextResponse.json({
      ok: true,
      agentId: ctx.agentId,
      windowDays: days,
      ...data,
    });
  } catch (e: any) {
    if (e?.message === "Not authenticated") {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    console.error("GET /api/dashboard/revenue/summary", e);
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}
