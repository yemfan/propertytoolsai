import { NextResponse } from "next/server";
import { requireMobileAgent } from "@/lib/mobile/auth";
import { patchMobileLeadTask } from "@/lib/mobile/leadTasksMobile";
import type { MobileTaskPriority, MobileTaskStatus } from "@leadsmart/shared";

export const runtime = "nodejs";

type PatchBody = {
  status?: MobileTaskStatus;
  title?: string;
  description?: string | null;
  due_at?: string | null;
  priority?: MobileTaskPriority;
};

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireMobileAgent(req);
  if (auth.ok === false) return auth.response;

  try {
    const { id } = await ctx.params;
    const taskId = String(id ?? "").trim();
    if (!taskId) {
      return NextResponse.json({ ok: false, success: false, error: "Missing task id" }, { status: 400 });
    }

    const body = (await req.json().catch(() => ({}))) as PatchBody;
    const task = await patchMobileLeadTask({
      agentId: auth.ctx.agentId,
      taskId,
      status: body.status,
      title: body.title,
      description: body.description,
      dueAt: body.due_at,
      priority: body.priority,
    });

    return NextResponse.json({ ok: true, success: true, task });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    if (msg === "NOT_FOUND") {
      return NextResponse.json({ ok: false, success: false, error: "Task not found" }, { status: 404 });
    }
    console.error("PATCH /api/mobile/tasks/[id]", e);
    return NextResponse.json({ ok: false, success: false, error: msg }, { status: 500 });
  }
}
