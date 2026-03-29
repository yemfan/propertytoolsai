import { NextResponse } from "next/server";
import { clampIntDays, getFunnelStageCounts } from "@/lib/analytics/saasMetrics";
import { requireRoleRoute } from "@/lib/auth/requireRole";

/** GET — funnel state + distinct users per funnel event type in the window. */
export async function GET(req: Request) {
  try {
    const auth = await requireRoleRoute(["admin"], { strictUnauthorized: true });
    if (auth.ok === false) return auth.response;

    const { searchParams } = new URL(req.url);
    const windowDays = clampIntDays(searchParams.get("days"), 30, 365);

    const funnel = await getFunnelStageCounts(windowDays);

    return NextResponse.json({
      success: true,
      generatedAt: new Date().toISOString(),
      ...funnel,
    });
  } catch (e) {
    console.error("[admin/metrics/funnel]", e);
    return NextResponse.json({ success: false, error: "Failed to load funnel metrics" }, { status: 500 });
  }
}
