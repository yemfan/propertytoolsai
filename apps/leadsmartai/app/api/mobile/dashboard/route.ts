import { NextResponse } from "next/server";
import { requireMobileAgent } from "@/lib/mobile/auth";
import { getMobileDashboard } from "@/lib/mobile/mobileDashboard";
import { getLatestDigest } from "@/lib/digest/digestBuilder";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = await requireMobileAgent(req);
  if (auth.ok === false) return auth.response;

  try {
    const [payload, digest] = await Promise.all([
      getMobileDashboard(auth.ctx.agentId),
      getLatestDigest(auth.ctx.agentId).catch(() => null),
    ]);

    return NextResponse.json({
      ok: true,
      success: true,
      ...payload,
      weeklyDigest: digest
        ? {
            title: digest.title,
            body: digest.body,
            weekStart: digest.week_start,
            weekEnd: digest.week_end,
            metrics: digest.metrics,
            insights: digest.insights,
          }
        : null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("GET /api/mobile/dashboard", e);
    return NextResponse.json({ ok: false, success: false, error: msg }, { status: 500 });
  }
}
