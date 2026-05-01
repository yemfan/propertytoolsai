import { NextResponse } from "next/server";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import { cancelTask, deleteTask, rescheduleTask, toggleTask } from "@/lib/playbooks/service";

export const runtime = "nodejs";

/**
 * PATCH /api/dashboard/playbooks/[taskId]
 *   Body (any subset, applied in order): {
 *     completed?: boolean,    // toggle completed_at
 *     cancelled?: boolean,    // toggle cancelled_at (soft cancel)
 *     dueDate?: string | null // reschedule, YYYY-MM-DD or null to clear
 *   }
 *   Returns the row after the last applied mutation. Multiple fields
 *   in one body are allowed (e.g. uncancel + reschedule together) but
 *   the typical UI sends one at a time.
 *
 * DELETE /api/dashboard/playbooks/[taskId]
 *   Hard-removes one task. Prefer the cancel toggle (PATCH) for
 *   "decided not to do" — keeps audit history.
 */
export async function PATCH(req: Request, ctx: { params: Promise<{ taskId: string }> }) {
  try {
    const { agentId } = await getCurrentAgentContext();
    const { taskId } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as {
      completed?: boolean;
      cancelled?: boolean;
      dueDate?: string | null;
    };
    let task = null;
    if (typeof body.completed === "boolean") {
      task = await toggleTask(String(agentId), taskId, body.completed);
    }
    if (typeof body.cancelled === "boolean") {
      task = await cancelTask(String(agentId), taskId, body.cancelled);
    }
    if (body.dueDate !== undefined) {
      task = await rescheduleTask(String(agentId), taskId, body.dueDate);
    }
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
