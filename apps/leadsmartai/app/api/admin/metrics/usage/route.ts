import { NextResponse } from "next/server";
import { clampIntDays, daysAgoIso, getUsageBreakdown } from "@/lib/analytics/saasMetrics";
import { requireRoleRoute } from "@/lib/auth/requireRole";

/** GET — feature / usage event breakdown from usage_events. */
export async function GET(req: Request) {
  try {
    const auth = await requireRoleRoute(["admin"], { strictUnauthorized: true });
    if (auth.ok === false) return auth.response;

    const { searchParams } = new URL(req.url);
    const days = clampIntDays(searchParams.get("days"), 30, 365);
    const since = daysAgoIso(days);

    const breakdown = await getUsageBreakdown(since);

    return NextResponse.json({
      success: true,
      generatedAt: new Date().toISOString(),
      windowDays: days,
      breakdown,
    });
  } catch (e) {
    console.error("[admin/metrics/usage]", e);
    return NextResponse.json({ success: false, error: "Failed to load usage metrics" }, { status: 500 });
  }
}
