import { NextResponse } from "next/server";

import { requireMobileAgent } from "@/lib/mobile/auth";
import { topLikelySellersForAgent } from "@/lib/spherePrediction/service";

export const runtime = "nodejs";

/**
 * GET /api/mobile/sphere/sellers
 *
 * Mobile-side counterpart to /api/dashboard/sphere/likely-sellers.
 * Returns the agent's top likely-sellers (rules-based + ranked by
 * score). Same `LikelySellerRow` shape as the web endpoint.
 *
 * Query:
 *   limit     default 10, max 50
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

    const sellers = await topLikelySellersForAgent(auth.ctx.agentId, {
      limit,
      minScore,
      label,
    });

    return NextResponse.json({ ok: true, success: true, sellers });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("[mobile/sphere/sellers]", e);
    return NextResponse.json(
      { ok: false, success: false, error: msg },
      { status: 500 },
    );
  }
}
