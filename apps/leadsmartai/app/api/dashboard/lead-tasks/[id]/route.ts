import { NextResponse } from "next/server";
import { patchMobileLeadTask } from "@/lib/mobile/leadTasksMobile";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import type { MobileTaskPriority, MobileTaskStatus } from "@leadsmart/shared";

export const runtime = "nodejs";

type PatchBody = {
  status?: MobileTaskStatus;
  title?: string;
  description?: string | null;
  dueAt?: string | null;
  priority?: MobileTaskPriority;
};

/**
 * Updates `lead_tasks` rows (same source as mobile Tasks / reminders overdue list).
 */
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { agentId } = await getCurrentAgentContext();
    const { id } = await ctx.params;
    const taskId = String(id ?? "").trim();
    if (!taskId) {
      return NextResponse.json({ ok: false, error: "Missing task id" }, { status: 400 });
    }

    const body = (await req.json().catch(() => ({}))) as PatchBody;
    const task = await patchMobileLeadTask({
      agentId,
      taskId,
      status: body.status,
      title: body.title,
      description: body.description,
      dueAt: body.dueAt,
      priority: body.priority,
    });

    return NextResponse.json({ ok: true, task });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    if (msg === "NOT_FOUND") {
      return NextResponse.json({ ok: false, error: "Task not found" }, { status: 404 });
    }
    console.error("dashboard lead-tasks PATCH", e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
