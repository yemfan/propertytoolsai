export type PlanStatus = "draft" | "approved" | "active" | "paused" | "completed" | "cancelled";
export type TriggerType = "manual" | "new_lead" | "new_listing" | "recent_sale" | "stale_lead";
export type StepChannel = "sms" | "email" | "task" | "notification";
export type StepAction = "send_sms" | "send_email" | "create_task" | "send_notification";
export type StepStatus = "pending" | "scheduled" | "executed" | "skipped" | "failed";
export type TemplateKey = "buyer_nurture" | "seller_nurture" | "new_listing" | "recent_sale" | "stale_reengagement";

export type MarketingPlanRow = {
  id: string;
  agent_id: string;
  contact_id: string | null;
  template_key: string;
  title: string;
  status: PlanStatus;
  trigger_type: TriggerType | null;
  approved_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  metadata_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type MarketingPlanStepRow = {
  id: string;
  plan_id: string;
  step_order: number;
  channel: StepChannel;
  action: StepAction;
  subject: string | null;
  body: string;
  delay_days: number;
  enabled: boolean;
  status: StepStatus;
  executed_at: string | null;
  execution_result: Record<string, unknown> | null;
  created_at: string;
};

export type PlanWithSteps = MarketingPlanRow & {
  steps: MarketingPlanStepRow[];
};

/** Template step definition (used in plan generation). */
export type TemplateStep = {
  channel: StepChannel;
  action: StepAction;
  subject?: string;
  body: string;
  delay_days: number;
};

/** Template definition for plan generation. */
export type PlanTemplate = {
  key: TemplateKey;
  title: string;
  description: string;
  trigger_type: TriggerType;
  steps: TemplateStep[];
};
