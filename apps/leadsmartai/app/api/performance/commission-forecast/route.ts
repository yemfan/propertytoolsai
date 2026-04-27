import { NextResponse } from "next/server";

import { getCurrentAgentContext } from "@/lib/dashboardService";
import { getCommissionForecast } from "@/lib/performance/commissionForecastService";

export const runtime = "nodejs";

/**
 * GET /api/performance/commission-forecast
 *
 * Returns the in-flight commission forecast for the authed agent —
 * active + pending deals weighted by close-date proximity. Companion
 * to /api/performance/revenue (which is closed deals only).
 *
 * The route is parameterless: forecast is always "right now". If we
 * ever want a "forecast as of last quarter" view we can add a `nowIso`
 * query param the service layer already accepts.
 */
export async function GET() {
  try {
    const { agentId } = await getCurrentAgentContext();
    const summary = await getCommissionForecast(String(agentId));
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error("GET /api/performance/commission-forecast:", err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
