import { NextResponse } from "next/server";
import { requireMobileAgent } from "@/lib/mobile/auth";
import { deleteTask, updateTask } from "@/lib/transactions/service";

export const runtime = "nodejs";

/**
 * PATCH /api/mobile/transactions/[id]/tasks/[taskId]
 *   Toggle completion or edit title/description/due_date/stage.
 *   Body: { title?, description?, due_date?, stage?, completed? }
 *
 * DELETE /api/mobile/transactions/[id]/tasks/[taskId]
 *   Only custom tasks are deletable — seeded tasks can be marked
 *   complete but not removed (service enforces).
 */
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string; taskId: string }> },
) {
  const auth = await requireMobileAgent(req);
  if (auth.ok === false) return auth.response;

  try {
    const { taskId } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as Parameters<typeof updateTask>[2];
    const task = await updateTask(auth.ctx.agentId, taskId, body);
    if (!task) {
      return NextResponse.json(
        { ok: false, success: false, error: "Not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true, success: true, task });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("PATCH /api/mobile/transactions/[id]/tasks/[taskId]", e);
    return NextResponse.json(
      { ok: false, success: false, error: msg },
      { status: 500 },
    );
  }
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string; taskId: string }> },
) {
  const auth = await requireMobileAgent(req);
  if (auth.ok === false) return auth.response;

  try {
    const { taskId } = await ctx.params;
    const ok = await deleteTask(auth.ctx.agentId, taskId);
    if (!ok) {
      return NextResponse.json(
        {
          ok: false,
          success: false,
          error: "Not found, or seeded tasks cannot be deleted.",
        },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true, success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("DELETE /api/mobile/transactions/[id]/tasks/[taskId]", e);
    return NextResponse.json(
      { ok: false, success: false, error: msg },
      { status: 500 },
    );
  }
}
