import { NextResponse } from "next/server";
import { runLeadMarketplacePipeline } from "@/lib/leadScorePipeline";

export const runtime = "nodejs";

/**
 * POST /api/leads/:id/score — recompute marketplace score + price (rules engine).
 * Secured by deployment (internal/cron); add auth if exposed publicly.
 */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    if (!id) {
      return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
    }

    const result = await runLeadMarketplacePipeline(String(id));
    if (!result) {
      return NextResponse.json({ ok: false, error: "Lead not found or update failed." }, { status: 404 });
    }

    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    console.error("POST /api/leads/[id]/score", e);
    return NextResponse.json({ ok: false, error: e?.message ?? "Server error" }, { status: 500 });
  }
}
