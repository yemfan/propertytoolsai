export type TaskStatus = "open" | "done" | "cancelled";
export type TaskPriority = "low" | "normal" | "high" | "urgent";
export type TaskSource = "agent" | "ai" | "system" | "automation";

export type PipelineStageRow = {
  id: string;
  agent_id: string;
  name: string;
  slug: string;
  position: number;
  color: string | null;
  created_at: string;
};

export type CrmTaskRow = {
  id: string;
  agent_id: string;
  lead_id: string | null;
  pipeline_stage_id: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_at: string | null;
  completed_at: string | null;
  source: TaskSource;
  ai_rationale: string | null;
  metadata_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type AiPipelinePlan = {
  summary: string;
  recommendedStageSlug: string | null;
  tasks: Array<{
    title: string;
    description?: string | null;
    dueInDays?: number | null;
    priority: TaskPriority;
  }>;
};
