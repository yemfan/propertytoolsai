import { NextResponse } from "next/server";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import { deleteBatch } from "@/lib/playbooks/service";

export const runtime = "nodejs";

/**
 * DELETE /api/dashboard/playbooks/batch/[batchId]
 *   Remove every task in this apply-batch. Use when the agent
 *   applied a playbook by mistake or wants to restart.
 */
export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ batchId: string }> },
) {
  try {
    const { agentId } = await getCurrentAgentContext();
    const { batchId } = await ctx.params;
    const removed = await deleteBatch(String(agentId), batchId);
    return NextResponse.json({ ok: true, removed });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error("DELETE /api/dashboard/playbooks/batch/[batchId]:", err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
