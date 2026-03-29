import { NextResponse } from "next/server";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import { updateTaskForAgent } from "@/lib/crm/pipeline/tasks";
import { supabaseServer } from "@/lib/supabaseServer";
import type { TaskPriority, TaskStatus } from "@/lib/crm/pipeline/types";

export const runtime = "nodejs";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { agentId } = await getCurrentAgentContext();
    const { id: taskId } = await ctx.params;
    if (!taskId) {
      return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      title?: string;
      description?: string | null;
      status?: TaskStatus;
      priority?: TaskPriority;
      due_at?: string | null;
      pipeline_stage_id?: string | null;
    };

    if (body.pipeline_stage_id) {
      const { data: st, error: se } = await supabaseServer
        .from("crm_pipeline_stages")
        .select("id")
        .eq("id", body.pipeline_stage_id)
        .eq("agent_id", agentId as any)
        .maybeSingle();
      if (se) throw se;
      if (!st) {
        return NextResponse.json({ ok: false, error: "Invalid pipeline stage." }, { status: 400 });
      }
    }

    const task = await updateTaskForAgent(agentId, taskId, {
      title: body.title,
      description: body.description,
      status: body.status,
      priority: body.priority,
      due_at: body.due_at,
      pipeline_stage_id: body.pipeline_stage_id,
    });

    return NextResponse.json({ ok: true, task });
  } catch (e: any) {
    console.error("dashboard tasks PATCH", e);
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}
