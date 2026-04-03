import { NextResponse } from "next/server";
import { clampIntDays, getFunnelStageCounts } from "@/lib/analytics/saasMetrics";
import { adminMetricsErrorResponse, requireAdminMetricsSupabase } from "@/lib/admin/adminMetricsRoutes";
import { requireRoleRoute } from "@/lib/auth/requireRole";

/** GET — funnel state + distinct users per funnel event type in the window. */
export async function GET(req: Request) {
  try {
    const auth = await requireRoleRoute(["admin"], { strictUnauthorized: true });
    if (auth.ok === false) return auth.response;

    const misconfigured = requireAdminMetricsSupabase();
    if (misconfigured) return misconfigured;

    const { searchParams } = new URL(req.url);
    const windowDays = clampIntDays(searchParams.get("days"), 30, 365);

    const funnel = await getFunnelStageCounts(windowDays);

    return NextResponse.json({
      success: true,
      generatedAt: new Date().toISOString(),
      ...funnel,
    });
  } catch (e) {
    return adminMetricsErrorResponse("[admin/metrics/funnel]", e, "Failed to load funnel metrics");
  }
}
