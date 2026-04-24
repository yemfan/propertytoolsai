import { NextResponse } from "next/server";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import {
  getDealReview,
  regenerateDealReview,
} from "@/lib/deal-review/service";
import { canUseAiAction } from "@/lib/entitlements/accessResult";
import { consumeAiToken } from "@/lib/entitlements/consumeAiToken";

export const runtime = "nodejs";
// Claude cold generation runs 10-30s. Cached reads return in milliseconds.
export const maxDuration = 60;

/**
 * GET /api/dashboard/transactions/[id]/review
 *   Cache-first. First call after a deal closes may take ~15s as the
 *   model generates; subsequent opens are instant.
 *
 * POST /api/dashboard/transactions/[id]/review
 *   Force-regenerate, bypassing the cache. Wired to the "Regenerate"
 *   button in the UI.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { agentId, userId } = await getCurrentAgentContext();
    const { id } = await ctx.params;

    // Optimistic flow for GET: try to serve from cache first. Only
    // check+consume AI quota when we actually need to generate. This
    // keeps the cached-read path on its existing millisecond budget
    // and concentrates the quota cost on the genuine AI call.
    const result = await getDealReview(String(agentId), id);
    if (!result) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

    if (!result.fromCache) {
      // First-time generation actually happened in the pipeline.
      // Post-consume here (best-effort). We don't pre-check the limit
      // on GET because the happy-path hit-rate on the cache is ~100%
      // once a review has been generated once — pre-checking would
      // add a query per read for no reward.
      try {
        const check = await canUseAiAction(userId);
        if (!check.allowed) {
          // Review was generated successfully, but the user is now
          // over their quota. Serve this one + flag it — next
          // regenerate is blocked.
          return NextResponse.json({
            ok: true,
            ...result,
            aiOverQuota: true,
            aiQuotaResult: check,
          });
        }
        await consumeAiToken(userId);
      } catch (usageErr) {
        console.warn("[deal-review GET] usage increment failed:", usageErr);
      }
    }

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    const status = /only available on closed/i.test(message) ? 400 : 500;
    console.error("GET review:", err);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { agentId, userId } = await getCurrentAgentContext();
    const { id } = await ctx.params;

    // Regenerate is an explicit AI call — pre-check.
    const check = await canUseAiAction(userId);
    if (!check.allowed) {
      return NextResponse.json(
        { ok: false, error: "AI action limit reached", result: check },
        { status: 403 },
      );
    }

    const result = await regenerateDealReview(String(agentId), id);
    if (!result) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

    try {
      await consumeAiToken(userId);
    } catch (usageErr) {
      console.warn("[deal-review POST] usage increment failed:", usageErr);
    }

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    const status = /only available on closed/i.test(message) ? 400 : 500;
    console.error("POST review:", err);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
