import { NextResponse } from "next/server";

import { suggestNextPosts } from "@/lib/leads-gen/suggest-next-post";
import { requireMobileAgent } from "@/lib/mobile/auth";

export const runtime = "nodejs";

/**
 * GET /api/mobile/leads-gen/suggestions/next-post
 *
 * Returns 1-3 deterministic post suggestions ranked by urgency.
 * Powers the mobile Home "Suggested next post" card. Cross-
 * references CRM subjects (listings, open houses, just-solds)
 * against the last 30 days of published posts to find what hasn't
 * been promoted yet.
 *
 * Query params:
 *   ?limit=N (default 3, max 10)
 *
 * Empty array when nothing's worth surfacing — the card hides
 * itself in that case rather than showing a stub.
 *
 * No plan gate: the suggestion itself doesn't generate anything
 * billable. The follow-up Quick Post draft hits the Pro+ check.
 */
export async function GET(req: Request) {
  const auth = await requireMobileAgent(req);
  if (auth.ok === false) return auth.response;

  try {
    const url = new URL(req.url);
    const limit = Number(url.searchParams.get("limit") ?? "3");
    const suggestions = await suggestNextPosts({
      agentId: auth.ctx.agentId,
      limit: Number.isFinite(limit) ? limit : 3,
    });
    return NextResponse.json({
      ok: true,
      success: true,
      suggestions,
    });
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : "Failed to load suggestions";
    console.error("[mobile/leads-gen/suggestions/next-post]", e);
    return NextResponse.json(
      { ok: false, success: false, error: msg },
      { status: 500 },
    );
  }
}
