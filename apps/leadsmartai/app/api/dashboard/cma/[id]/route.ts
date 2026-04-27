import { NextResponse } from "next/server";

import { deleteCmaForAgent, getCmaForAgent } from "@/lib/cma/service";
import { getCurrentAgentContext } from "@/lib/dashboardService";

export const runtime = "nodejs";

/**
 * GET    — full CMA snapshot (subject + comps + valuation + strategies).
 * DELETE — remove a saved CMA. RLS already gates this at the DB layer
 *          but we double-check the agent owns it for clarity.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { agentId } = await getCurrentAgentContext();
    const { id } = await ctx.params;
    const cma = await getCmaForAgent(String(agentId), id);
    if (!cma) {
      return NextResponse.json({ ok: false, error: "CMA not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, cma });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { agentId } = await getCurrentAgentContext();
    const { id } = await ctx.params;
    const deleted = await deleteCmaForAgent(String(agentId), id);
    if (!deleted) {
      return NextResponse.json({ ok: false, error: "CMA not found or delete failed" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
