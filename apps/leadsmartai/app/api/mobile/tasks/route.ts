import { NextResponse } from "next/server";
import { requireMobileAgent } from "@/lib/mobile/auth";
import { createMobileLeadTask, listMobileTasksGrouped } from "@/lib/mobile/leadTasksMobile";
import type { MobileTaskPriority } from "@leadsmart/shared";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = await requireMobileAgent(req);
  if (auth.ok === false) return auth.response;

  try {
    const grouped = await listMobileTasksGrouped(auth.ctx.agentId);
    return NextResponse.json({ ok: true, success: true, ...grouped });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("GET /api/mobile/tasks", e);
    return NextResponse.json({ ok: false, success: false, error: msg }, { status: 500 });
  }
}

type PostBody = {
  contact_id?: string;
  title?: string;
  description?: string | null;
  due_at?: string | null;
  priority?: MobileTaskPriority;
  task_type?: string | null;
};

export async function POST(req: Request) {
  const auth = await requireMobileAgent(req);
  if (auth.ok === false) return auth.response;

  try {
    const body = (await req.json().catch(() => ({}))) as PostBody;
    const leadId = String(body.contact_id ?? "").trim();
    const title = String(body.title ?? "").trim();
    if (!leadId) {
      return NextResponse.json({ ok: false, success: false, error: "lead_id is required" }, { status: 400 });
    }
    if (!title) {
      return NextResponse.json({ ok: false, success: false, error: "title is required" }, { status: 400 });
    }

    const task = await createMobileLeadTask({
      agentId: auth.ctx.agentId,
      leadId,
      title,
      description: body.description,
      dueAt: body.due_at,
      priority: body.priority,
      taskType: body.task_type,
    });

    return NextResponse.json({ ok: true, success: true, task });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    if (msg === "NOT_FOUND") {
      return NextResponse.json({ ok: false, success: false, error: "Lead not found" }, { status: 404 });
    }
    console.error("POST /api/mobile/tasks", e);
    return NextResponse.json({ ok: false, success: false, error: msg }, { status: 500 });
  }
}
