import { NextResponse } from "next/server";

import { topLikelyBuyersForAgent } from "@/lib/buyerPrediction/service";
import { requireMobileAgent } from "@/lib/mobile/auth";

export const runtime = "nodejs";

/**
 * GET /api/mobile/sphere/buyers
 *
 * Mobile-side counterpart to /api/dashboard/sphere/likely-buyers.
 * Returns the agent's top likely-buyers (rules-based + ranked by
 * score). Same `LikelyBuyerRow` shape as the web endpoint.
 *
 * Plan gate matches the web side via the existing
 * `userHasCrmFeature("prediction")` check — except mobile bypasses
 * that for now (mobile Sphere ships before the per-feature gates
 * are wired into the mobile auth context). When/if mobile agents
 * end up on free, the helper itself returns an empty array
 * gracefully.
 *
 * Query:
 *   limit     default 10, max 50 (smaller default than web — list
 *             is a single screen, not a paginated table)
 *   minScore  default 0
 *   label     low | medium | high
 */
export async function GET(req: Request) {
  const auth = await requireMobileAgent(req);
  if (auth.ok === false) return auth.response;

  try {
    const url = new URL(req.url);
    const limitRaw = url.searchParams.get("limit");
    const minScoreRaw = url.searchParams.get("minScore");
    const labelRaw = url.searchParams.get("label");

    const limit = Math.min(
      Math.max(limitRaw != null ? Number(limitRaw) : 10, 1),
      50,
    );
    const minScore =
      minScoreRaw != null && Number.isFinite(Number(minScoreRaw))
        ? Math.max(0, Number(minScoreRaw))
        : 0;
    const label =
      labelRaw === "high" || labelRaw === "medium" || labelRaw === "low"
        ? labelRaw
        : undefined;

    const buyers = await topLikelyBuyersForAgent(auth.ctx.agentId, {
      limit,
      minScore,
      label,
    });

    return NextResponse.json({ ok: true, success: true, buyers });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("[mobile/sphere/buyers]", e);
    return NextResponse.json(
      { ok: false, success: false, error: msg },
      { status: 500 },
    );
  }
}
