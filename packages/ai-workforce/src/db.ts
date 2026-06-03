// The data-access boundary for the AI Workforce runtime. Rows come back snake_cased
// with jsonb columns typed as `Json`; these mappers turn them into the camelCase
// domain model in ./types so the rest of the runtime (and consumers) never touch the
// raw row shape. Inserts are built inline at each call site against the typed client.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@helm/data/types";
import type {
  AiEmployee,
  AiEmployeeTool,
  AiEmployeeRun,
  AiEmployeeMemory,
  AiEmployeeMetric,
  EmployeeGoal,
  EmployeePermissions,
  EmployeeStatus,
  MemoryKind,
  RunStatus,
} from "./types";

export type Db = SupabaseClient<Database>;

type Tables = Database["public"]["Tables"];
export type EmployeeRow = Tables["ai_employees"]["Row"];
export type ToolRow = Tables["ai_employee_tools"]["Row"];
export type RunRow = Tables["ai_employee_runs"]["Row"];
export type MemoryRow = Tables["ai_employee_memory"]["Row"];
export type MetricRow = Tables["ai_employee_metrics"]["Row"];

export function rowToEmployee(r: EmployeeRow): AiEmployee {
  return {
    id: r.id,
    organizationId: r.organization_id,
    slug: r.slug,
    name: r.name,
    role: r.role,
    department: r.department,
    dnaModule: r.dna_module,
    industryPack: r.industry_pack,
    goals: (r.goals as unknown as EmployeeGoal[]) ?? [],
    knowledgeSources: (r.knowledge_sources as unknown as string[]) ?? [],
    permissions: (r.permissions as unknown as EmployeePermissions) ?? {},
    model: r.model,
    personality: r.personality,
    status: r.status as EmployeeStatus,
    config: (r.config as unknown as Record<string, unknown>) ?? {},
  };
}

export function rowToTool(r: ToolRow): AiEmployeeTool {
  return {
    id: r.id,
    organizationId: r.organization_id,
    employeeId: r.employee_id,
    toolKey: r.tool_key,
    dnaModule: r.dna_module,
    enabled: r.enabled,
    config: (r.config as unknown as Record<string, unknown>) ?? {},
  };
}

export function rowToRun(r: RunRow): AiEmployeeRun {
  return {
    id: r.id,
    organizationId: r.organization_id,
    employeeId: r.employee_id,
    channel: r.channel,
    subjectType: r.subject_type,
    subjectId: r.subject_id,
    status: r.status as RunStatus,
    outcome: (r.outcome as unknown as Record<string, unknown>) ?? {},
    tokensUsed: r.tokens_used,
    costCents: r.cost_cents,
    startedAt: r.started_at,
    endedAt: r.ended_at,
  };
}

export function rowToMemory(r: MemoryRow): AiEmployeeMemory {
  return {
    id: r.id,
    organizationId: r.organization_id,
    employeeId: r.employee_id,
    subjectType: r.subject_type,
    subjectId: r.subject_id,
    kind: r.kind as MemoryKind,
    content: r.content,
    importance: r.importance,
    expiresAt: r.expires_at,
  };
}

export function rowToMetric(r: MetricRow): AiEmployeeMetric {
  return {
    id: r.id,
    organizationId: r.organization_id,
    employeeId: r.employee_id,
    metricDate: r.metric_date,
    metricKey: r.metric_key,
    metricValue: r.metric_value,
  };
}
