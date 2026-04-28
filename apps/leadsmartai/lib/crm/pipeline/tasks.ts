import { supabaseServer } from "@/lib/supabaseServer";
import type { CrmTaskRow, TaskPriority, TaskSource, TaskStatus } from "./types";

export async function listTasksForAgent(params: {
  agentId: string;
  /** When provided, lists tasks across these agent ids (team mode).
   *  Falls back to single-agent filter when omitted. */
  agentIds?: ReadonlyArray<string>;
  leadId?: string | null;
  status?: TaskStatus | "open_only";
  limit?: number;
}): Promise<CrmTaskRow[]> {
  const lim = Math.min(Math.max(params.limit ?? 100, 1), 200);
  const ids = params.agentIds && params.agentIds.length > 0
    ? params.agentIds
    : [params.agentId];
  let q = supabaseServer
    .from("crm_tasks")
    .select(
      "id,agent_id,contact_id,pipeline_stage_id,title,description,status,priority,due_at,completed_at,source,ai_rationale,metadata_json,created_at,updated_at"
    )
    .in("agent_id", ids as string[])
    .order("due_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(lim);

  if (params.leadId) q = q.eq("contact_id", params.leadId as any);
  if (params.status === "open_only" || params.status === "open") {
    q = q.eq("status", "open");
  } else if (params.status) {
    q = q.eq("status", params.status);
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as CrmTaskRow[];
}

export async function createTask(params: {
  agentId: string;
  leadId?: string | null;
  pipelineStageId?: string | null;
  title: string;
  description?: string | null;
  priority?: TaskPriority;
  dueAt?: string | null;
  source?: TaskSource;
  aiRationale?: string | null;
}): Promise<CrmTaskRow> {
  const now = new Date().toISOString();
  const row = {
    agent_id: params.agentId as any,
    contact_id: params.leadId ?? null,
    pipeline_stage_id: params.pipelineStageId ?? null,
    title: params.title.trim(),
    description: params.description?.trim() || null,
    status: "open" as const,
    priority: params.priority ?? "normal",
    due_at: params.dueAt ?? null,
    source: params.source ?? "agent",
    ai_rationale: params.aiRationale ?? null,
    metadata_json: {},
    created_at: now,
    updated_at: now,
  };

  const { data, error } = await supabaseServer.from("crm_tasks").insert(row as any).select().single();
  if (error) throw new Error(error.message);
  return data as unknown as CrmTaskRow;
}

export async function updateTaskForAgent(
  agentId: string,
  taskId: string,
  patch: Partial<{
    title: string;
    description: string | null;
    status: TaskStatus;
    priority: TaskPriority;
    due_at: string | null;
    pipeline_stage_id: string | null;
  }>
): Promise<CrmTaskRow> {
  const now = new Date().toISOString();
  const body: Record<string, unknown> = { updated_at: now };
  if (patch.title != null) body.title = patch.title.trim();
  if (patch.description !== undefined) body.description = patch.description;
  if (patch.status != null) {
    body.status = patch.status;
    body.completed_at = patch.status === "done" ? now : null;
  }
  if (patch.priority != null) body.priority = patch.priority;
  if (patch.due_at !== undefined) body.due_at = patch.due_at;
  if (patch.pipeline_stage_id !== undefined) body.pipeline_stage_id = patch.pipeline_stage_id;

  const { data, error } = await supabaseServer
    .from("crm_tasks")
    .update(body as any)
    .eq("id", taskId)
    .eq("agent_id", agentId as any)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as unknown as CrmTaskRow;
}
