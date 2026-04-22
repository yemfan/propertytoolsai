import { NextResponse } from "next/server";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import { deleteTask, updateTask } from "@/lib/transactions/service";

export const runtime = "nodejs";

/**
 * PATCH /api/dashboard/transactions/[id]/tasks/[taskId]
 * Toggle completion, edit title/description/due_date/stage.
 *
 * Body: { title?, description?, due_date?, stage?, completed? }
 */
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string; taskId: string }> },
) {
  try {
    const { agentId } = await getCurrentAgentContext();
    const { taskId } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as Parameters<typeof updateTask>[2];
    const task = await updateTask(String(agentId), taskId, body);
    if (!task) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true, task });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error(`PATCH task:`, err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/dashboard/transactions/[id]/tasks/[taskId]
 * Only custom tasks can be deleted — seeded tasks can be marked
 * complete but not removed (see service.deleteTask docstring).
 */
export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string; taskId: string }> },
) {
  try {
    const { agentId } = await getCurrentAgentContext();
    const { taskId } = await ctx.params;
    const ok = await deleteTask(String(agentId), taskId);
    if (!ok) {
      return NextResponse.json(
        { ok: false, error: "Not found, or seeded tasks cannot be deleted." },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error(`DELETE task:`, err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
