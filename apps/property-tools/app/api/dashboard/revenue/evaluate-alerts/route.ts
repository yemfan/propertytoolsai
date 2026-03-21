import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/adminRole";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import { evaluateAndEmitAlerts } from "@/lib/revenueKpi/db";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const ctx = await getCurrentAgentContext();
    const forbidden = await requireAdminApi(ctx.userId);
    if (forbidden) return forbidden;

    const body = (await req.json().catch(() => ({}))) as { days?: number };
    const days = Math.max(1, Math.min(366, Number(body.days ?? 30)));

    const result = await evaluateAndEmitAlerts(ctx.agentId, days);

    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    if (e?.message === "Not authenticated") {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    console.error("POST /api/dashboard/revenue/evaluate-alerts", e);
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}
