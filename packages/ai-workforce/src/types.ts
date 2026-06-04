// AI Workforce domain model — first-class AI employees. Mirrors 00048_ai_workforce.
// An employee is a DEFINITION (who they are, what they may do); runs/memory/metrics
// are instances/facts that accrue at runtime. See AI_Workforce_Design.md.

export type DnaModule =
  | "revenue"
  | "marketing"
  | "service"
  | "operations"
  | "finance"
  | "people"
  | "communication"
  | "knowledge"
  | "intelligence"
  | "platform";

export type EmployeeStatus = "active" | "paused" | "draft";

/** An ordered objective for an employee, tied to a KPI the Command Center can read. */
export interface EmployeeGoal {
  goal: string;
  kpi?: string;
  target?: number | string;
}

/** What an employee is allowed to do — rides the org role model + capability scopes. */
export interface EmployeePermissions {
  min_role?: "owner" | "admin" | "member" | "viewer" | "bookkeeper";
  scopes?: string[];
  autonomy?: "suggest" | "act_with_approval" | "autonomous";
}

/** The definition/registry row: Role, Goals, Tools(ref), Knowledge, Permissions, Memory, Metrics. */
export interface AiEmployee {
  id: string;
  organizationId: string;
  slug: string; // 'emma' | 'sarah' | 'mark' …
  name: string;
  role: string; // "AI Receptionist"
  department: string;
  dnaModule: DnaModule;
  industryPack: string | null; // null = Core employee; 'real_estate' = pack employee
  goals: EmployeeGoal[];
  knowledgeSources: string[];
  permissions: EmployeePermissions;
  model: string;
  personality: string;
  status: EmployeeStatus;
  config: Record<string, unknown>;
  /** Chosen persona avatar id (e.g. "persona-03"), or null to use a default. Stored in config.avatar.
   *  Optional in roster blueprints (a business assigns it); always present on a read employee. */
  avatar?: string | null;
}

/** A reference to a DNA service capability the employee may call — never embedded logic. */
export interface AiEmployeeTool {
  id: string;
  organizationId: string;
  employeeId: string;
  toolKey: string; // 'communication.send_sms' | 'finance.draft_invoice' …
  dnaModule: DnaModule;
  enabled: boolean;
  config: Record<string, unknown>;
}

export type MemoryKind = "episodic" | "semantic" | "summary";

/** What an employee remembers. subjectType/subjectId are soft refs (no cross-DNA FK). */
export interface AiEmployeeMemory {
  id: string;
  organizationId: string;
  employeeId: string;
  subjectType: string | null; // 'contact' | 'deal' | 'invoice' | 'org' | null
  subjectId: string | null;
  kind: MemoryKind;
  content: string;
  importance: number;
  expiresAt: string | null;
}

export type RunStatus = "running" | "succeeded" | "failed" | "escalated";

/** One execution / conversation of an employee (the instance). */
export interface AiEmployeeRun {
  id: string;
  organizationId: string;
  employeeId: string;
  channel: string | null; // 'voice' | 'sms' | 'email' | 'internal'
  subjectType: string | null;
  subjectId: string | null;
  status: RunStatus;
  outcome: Record<string, unknown>;
  tokensUsed: number;
  costCents: number;
  startedAt: string;
  endedAt: string | null;
}

/** Daily KPI rollup — the sanctioned source for the Command Center's AI Workforce node. */
export interface AiEmployeeMetric {
  id: string;
  organizationId: string;
  employeeId: string;
  metricDate: string;
  metricKey: string; // 'calls_answered' | 'appointments_booked' | 'tokens' | 'cost_cents' …
  metricValue: number;
}
