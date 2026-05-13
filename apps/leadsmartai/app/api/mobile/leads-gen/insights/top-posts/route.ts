import { NextResponse } from "next/server";

import { getTopPosts } from "@/lib/leads-gen/top-posts";
import { requireMobileAgent } from "@/lib/mobile/auth";

export const runtime = "nodejs";

/**
 * GET /api/mobile/leads-gen/insights/top-posts
 *
 * Returns the agent's top-engagement published posts from the last
 * 14 days, descending by likes + comments + shares + saves.
 *
 * Powers the mobile Home screen "Engagement" / "Top performers"
 * card. The card stays hidden until the agent has at least one
 * post with non-zero metrics — `hasMetrics: false` is the explicit
 * signal for that empty state.
 *
 * Query params:
 *   ?limit=N (default 3, max 20)
 *   ?windowDays=N (default 14)
 *
 * No plan gate: a Pro+ agent who published posts shouldn't get
 * 402'd reading their own engagement. The publish/draft endpoints
 * are where plan gating bites.
 */
export async function GET(req: Request) {
  const auth = await requireMobileAgent(req);
  if (auth.ok === false) return auth.response;

  try {
    const url = new URL(req.url);
    const limit = Number(url.searchParams.get("limit") ?? "3");
    const windowDaysParam = url.searchParams.get("windowDays");
    const windowDays = windowDaysParam ? Number(windowDaysParam) : undefined;

    const summary = await getTopPosts({
      agentId: auth.ctx.agentId,
      limit: Number.isFinite(limit) ? limit : 3,
      windowDays:
        windowDays && Number.isFinite(windowDays) ? windowDays : undefined,
    });

    return NextResponse.json({
      ok: true,
      success: true,
      items: summary.items,
      windowDays: summary.windowDays,
      hasMetrics: summary.hasMetrics,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load top posts";
    console.error("[mobile/leads-gen/insights/top-posts]", e);
    return NextResponse.json(
      { ok: false, success: false, error: msg },
      { status: 500 },
    );
  }
}
