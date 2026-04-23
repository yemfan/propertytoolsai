import { NextResponse } from "next/server";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import { deleteTask, toggleTask } from "@/lib/playbooks/service";

export const runtime = "nodejs";

/**
 * PATCH /api/dashboard/playbooks/[taskId]
 *   Body: { completed: boolean }
 *   Toggles the completed_at timestamp on a single task.
 *
 * DELETE /api/dashboard/playbooks/[taskId]
 *   Removes one task. To remove a whole applied playbook, use the
 *   batch endpoint.
 */
export async function PATCH(req: Request, ctx: { params: Promise<{ taskId: string }> }) {
  try {
    const { agentId } = await getCurrentAgentContext();
    const { taskId } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as { completed?: boolean };
    const task = await toggleTask(String(agentId), taskId, !!body.completed);
    if (!task) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true, task });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error("PATCH /api/dashboard/playbooks/[taskId]:", err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ taskId: string }> }) {
  try {
    const { agentId } = await getCurrentAgentContext();
    const { taskId } = await ctx.params;
    const ok = await deleteTask(String(agentId), taskId);
    if (!ok) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error("DELETE /api/dashboard/playbooks/[taskId]:", err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
