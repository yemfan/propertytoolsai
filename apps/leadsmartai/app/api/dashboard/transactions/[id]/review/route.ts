import { NextResponse } from "next/server";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import {
  getDealReview,
  regenerateDealReview,
} from "@/lib/deal-review/service";

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
    const { agentId } = await getCurrentAgentContext();
    const { id } = await ctx.params;
    const result = await getDealReview(String(agentId), id);
    if (!result) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
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
    const { agentId } = await getCurrentAgentContext();
    const { id } = await ctx.params;
    const result = await regenerateDealReview(String(agentId), id);
    if (!result) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    const status = /only available on closed/i.test(message) ? 400 : 500;
    console.error("POST review:", err);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
