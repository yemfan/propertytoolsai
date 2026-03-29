import { NextResponse } from "next/server";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import { createTask, listTasksForAgent } from "@/lib/crm/pipeline/tasks";
import { supabaseServer } from "@/lib/supabaseServer";
import type { TaskPriority } from "@/lib/crm/pipeline/types";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const { agentId } = await getCurrentAgentContext();
    const url = new URL(req.url);
    const leadId = url.searchParams.get("leadId")?.trim() || undefined;
    const statusParam = (url.searchParams.get("status") ?? "open").trim();

    let statusFilter: "open_only" | "open" | "done" | "cancelled" | undefined;
    if (statusParam === "all") statusFilter = undefined;
    else if (statusParam === "open") statusFilter = "open_only";
    else if (statusParam === "done" || statusParam === "cancelled") statusFilter = statusParam;
    else statusFilter = "open_only";

    const tasks = await listTasksForAgent({
      agentId,
      leadId: leadId || undefined,
      status: statusFilter,
      limit: 150,
    });

    return NextResponse.json({ ok: true, tasks });
  } catch (e: any) {
    console.error("dashboard tasks GET", e);
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const { agentId } = await getCurrentAgentContext();
    const body = (await req.json().catch(() => ({}))) as {
      leadId?: string | null;
      pipelineStageId?: string | null;
      title?: string;
      description?: string | null;
      priority?: TaskPriority;
      dueAt?: string | null;
    };

    const title = (body.title ?? "").trim();
    if (!title) {
      return NextResponse.json({ ok: false, error: "title is required" }, { status: 400 });
    }

    if (body.leadId) {
      const { data: lead, error: le } = await supabaseServer
        .from("leads")
        .select("id")
        .eq("id", body.leadId as any)
        .eq("agent_id", agentId as any)
        .maybeSingle();
      if (le) throw le;
      if (!lead) {
        return NextResponse.json({ ok: false, error: "Lead not found." }, { status: 404 });
      }
    }

    if (body.pipelineStageId) {
      const { data: st, error: se } = await supabaseServer
        .from("crm_pipeline_stages")
        .select("id")
        .eq("id", body.pipelineStageId)
        .eq("agent_id", agentId as any)
        .maybeSingle();
      if (se) throw se;
      if (!st) {
        return NextResponse.json({ ok: false, error: "Invalid pipeline stage." }, { status: 400 });
      }
    }

    const task = await createTask({
      agentId,
      leadId: body.leadId ?? null,
      pipelineStageId: body.pipelineStageId ?? null,
      title,
      description: body.description ?? null,
      priority: body.priority,
      dueAt: body.dueAt ?? null,
      source: "agent",
    });

    return NextResponse.json({ ok: true, task });
  } catch (e: any) {
    console.error("dashboard tasks POST", e);
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}
