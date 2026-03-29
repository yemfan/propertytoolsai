import { listMobilePipelineStages } from "@/lib/mobile/mobilePipeline";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type {
  MobileLeadTaskDto,
  MobilePipelineStageOptionDto,
  MobileTasksGroupedResponseDto,
  MobileTaskPriority,
  MobileTaskStatus,
} from "@leadsmart/shared";

function normalizePriority(p: string | undefined | null): MobileTaskPriority {
  const v = String(p || "medium").toLowerCase();
  if (v === "low" || v === "medium" || v === "high" || v === "urgent") return v;
  if (v === "normal") return "medium";
  return "medium";
}

function mapRow(
  row: Record<string, unknown>,
  leadName: string | null
): MobileLeadTaskDto {
  return {
    id: String(row.id ?? ""),
    lead_id: String(row.lead_id ?? ""),
    lead_name: leadName,
    title: String(row.title ?? ""),
    description: row.description != null ? String(row.description) : null,
    due_at: row.due_at != null ? String(row.due_at) : null,
    status: (String(row.status ?? "open") as MobileTaskStatus) || "open",
    priority: normalizePriority(row.priority as string),
    task_type: row.task_type != null ? String(row.task_type) : null,
    created_by: row.created_by != null ? String(row.created_by) : null,
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
    completed_at: row.completed_at != null ? String(row.completed_at) : null,
  };
}

function utcDayRange(d: Date): { start: Date; end: Date } {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const day = d.getUTCDate();
  return {
    start: new Date(Date.UTC(y, m, day, 0, 0, 0, 0)),
    end: new Date(Date.UTC(y, m, day, 23, 59, 59, 999)),
  };
}

function bucketForDue(due: string | null): "overdue" | "today" | "upcoming" {
  const now = new Date();
  if (!due) return "upcoming";
  const t = new Date(due).getTime();
  const { start, end } = utcDayRange(now);
  if (t < start.getTime()) return "overdue";
  if (t <= end.getTime()) return "today";
  return "upcoming";
}

export async function listMobileTasksGrouped(agentId: string): Promise<MobileTasksGroupedResponseDto> {
  const stages: MobilePipelineStageOptionDto[] = await listMobilePipelineStages(agentId);

  const { data: leads, error: leErr } = await supabaseAdmin
    .from("leads")
    .select("id,name")
    .eq("agent_id", agentId as never)
    .is("merged_into_lead_id", null);

  if (leErr) throw new Error(leErr.message);
  const leadRows = leads ?? [];
  const leadIds = leadRows.map((l) => String((l as { id: unknown }).id));
  const nameById = new Map<string, string | null>();
  for (const l of leadRows) {
    const r = l as { id: unknown; name: unknown };
    nameById.set(String(r.id), r.name != null ? String(r.name) : null);
  }

  const empty: MobileTasksGroupedResponseDto = {
    stages,
    overdue: [],
    today: [],
    upcoming: [],
  };

  if (!leadIds.length) return empty;

  const { data: tasks, error: tErr } = await supabaseAdmin
    .from("lead_tasks")
    .select(
      "id,lead_id,title,description,due_at,status,priority,task_type,created_by,created_at,updated_at,completed_at"
    )
    .in("lead_id", leadIds as never)
    .eq("status", "open")
    .order("due_at", { ascending: true, nullsFirst: false });

  if (tErr) throw new Error(tErr.message);

  const overdue: MobileLeadTaskDto[] = [];
  const today: MobileLeadTaskDto[] = [];
  const upcoming: MobileLeadTaskDto[] = [];

  for (const t of tasks ?? []) {
    const row = t as Record<string, unknown>;
    const leadId = String(row.lead_id ?? "");
    const dto = mapRow(row, nameById.get(leadId) ?? null);
    const b = bucketForDue(dto.due_at);
    if (b === "overdue") overdue.push(dto);
    else if (b === "today") today.push(dto);
    else upcoming.push(dto);
  }

  return { stages, overdue, today, upcoming };
}

async function assertLeadOwned(agentId: string, leadId: string): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from("leads")
    .select("id")
    .eq("id", leadId as never)
    .eq("agent_id", agentId as never)
    .is("merged_into_lead_id", null)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("NOT_FOUND");
}

export async function createMobileLeadTask(params: {
  agentId: string;
  leadId: string;
  title: string;
  description?: string | null;
  dueAt?: string | null;
  priority?: MobileTaskPriority;
  taskType?: string | null;
}): Promise<MobileLeadTaskDto> {
  await assertLeadOwned(params.agentId, params.leadId);

  const title = params.title.trim();
  if (!title) throw new Error("title is required");

  const row = {
    lead_id: params.leadId as never,
    assigned_agent_id: params.agentId as never,
    title,
    description: params.description?.trim() || null,
    due_at: params.dueAt?.trim() || null,
    status: "open",
    priority: params.priority ?? "medium",
    task_type: params.taskType?.trim() || null,
    created_by: "mobile",
    metadata_json: {},
  };

  const { data, error } = await supabaseAdmin
    .from("lead_tasks")
    .insert(row as never)
    .select(
      "id,lead_id,title,description,due_at,status,priority,task_type,created_by,created_at,updated_at,completed_at"
    )
    .single();

  if (error) throw new Error(error.message);

  const { data: lead } = await supabaseAdmin
    .from("leads")
    .select("name")
    .eq("id", params.leadId as never)
    .maybeSingle();

  const ln = lead != null && (lead as { name?: unknown }).name != null ? String((lead as { name: unknown }).name) : null;
  return mapRow(data as Record<string, unknown>, ln);
}

async function assertTaskForAgent(agentId: string, taskId: string): Promise<Record<string, unknown>> {
  const { data: task, error } = await supabaseAdmin
    .from("lead_tasks")
    .select("id,lead_id")
    .eq("id", taskId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!task) throw new Error("NOT_FOUND");

  await assertLeadOwned(agentId, String((task as { lead_id: unknown }).lead_id));
  return task as Record<string, unknown>;
}

export async function patchMobileLeadTask(params: {
  agentId: string;
  taskId: string;
  status?: MobileTaskStatus;
  title?: string;
  description?: string | null;
  dueAt?: string | null;
  priority?: MobileTaskPriority;
}): Promise<MobileLeadTaskDto> {
  await assertTaskForAgent(params.agentId, params.taskId);

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (params.title !== undefined) {
    const t = params.title.trim();
    if (!t) throw new Error("title cannot be empty");
    patch.title = t;
  }
  if (params.description !== undefined) patch.description = params.description?.trim() || null;
  if (params.dueAt !== undefined) patch.due_at = params.dueAt?.trim() || null;
  if (params.priority !== undefined) patch.priority = params.priority;
  if (params.status !== undefined) {
    patch.status = params.status;
    if (params.status === "done") {
      patch.completed_at = new Date().toISOString();
    } else if (params.status === "open") {
      patch.completed_at = null;
    }
  }

  const { data, error } = await supabaseAdmin
    .from("lead_tasks")
    .update(patch as never)
    .eq("id", params.taskId)
    .select(
      "id,lead_id,title,description,due_at,status,priority,task_type,created_by,created_at,updated_at,completed_at"
    )
    .single();

  if (error) throw new Error(error.message);

  const leadId = String((data as { lead_id: unknown }).lead_id ?? "");
  const { data: lead } = await supabaseAdmin
    .from("leads")
    .select("name")
    .eq("id", leadId as never)
    .maybeSingle();

  const ln = lead != null && (lead as { name?: unknown }).name != null ? String((lead as { name: unknown }).name) : null;
  return mapRow(data as Record<string, unknown>, ln);
}

export async function fetchNextOpenTaskForLead(
  agentId: string,
  leadId: string
): Promise<MobileLeadTaskDto | null> {
  await assertLeadOwned(agentId, leadId);

  const { data, error } = await supabaseAdmin
    .from("lead_tasks")
    .select(
      "id,lead_id,title,description,due_at,status,priority,task_type,created_by,created_at,updated_at,completed_at"
    )
    .eq("lead_id", leadId as never)
    .eq("status", "open")
    .order("due_at", { ascending: true, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const { data: lead } = await supabaseAdmin
    .from("leads")
    .select("name")
    .eq("id", leadId as never)
    .maybeSingle();

  const ln = lead != null && (lead as { name?: unknown }).name != null ? String((lead as { name: unknown }).name) : null;
  return mapRow(data as Record<string, unknown>, ln);
}
