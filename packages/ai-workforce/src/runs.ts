// Run lifecycle: one row per execution / conversation of an employee. Open a run,
// then close it with a terminal status, the outcome, and token/cost usage. These are
// the rows the Command Center and billing read to see what the workforce actually did.

import type { Json } from "@helm/data/types";
import type { AiEmployeeRun, RunStatus } from "./types";
import { type Db, rowToRun } from "./db";

export interface StartRunInput {
  employeeId: string;
  channel?: string | null; // 'voice' | 'sms' | 'email' | 'internal'
  subjectType?: string | null; // soft ref, e.g. 'contact' | 'invoice'
  subjectId?: string | null;
}

/** Open a run (status "running"); returns the run id. */
export async function startRun(db: Db, orgId: string, input: StartRunInput): Promise<string> {
  const { data, error } = await db
    .from("ai_employee_runs")
    .insert({
      organization_id: orgId,
      employee_id: input.employeeId,
      channel: input.channel ?? null,
      subject_type: input.subjectType ?? null,
      subject_id: input.subjectId ?? null,
      status: "running",
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Failed to start run");
  return data.id;
}

export interface CompleteRunInput {
  status: Exclude<RunStatus, "running">;
  outcome?: Record<string, unknown>;
  tokensUsed?: number;
  costCents?: number;
}

/** Close a run: terminal status, outcome, usage, and ended_at = now. */
export async function completeRun(
  db: Db,
  orgId: string,
  runId: string,
  input: CompleteRunInput
): Promise<void> {
  const { error } = await db
    .from("ai_employee_runs")
    .update({
      status: input.status,
      outcome: (input.outcome ?? {}) as unknown as Json,
      tokens_used: input.tokensUsed ?? 0,
      cost_cents: input.costCents ?? 0,
      ended_at: new Date().toISOString(),
    })
    .eq("id", runId)
    .eq("organization_id", orgId);
  if (error) throw new Error(error.message);
}

export type RunUsage = Pick<CompleteRunInput, "outcome" | "tokensUsed" | "costCents">;

/** Close a run as succeeded. */
export function succeedRun(db: Db, orgId: string, runId: string, usage: RunUsage = {}): Promise<void> {
  return completeRun(db, orgId, runId, { status: "succeeded", ...usage });
}

/** Close a run as failed, recording the reason in outcome.error. */
export function failRun(db: Db, orgId: string, runId: string, reason?: string, usage: RunUsage = {}): Promise<void> {
  return completeRun(db, orgId, runId, {
    status: "failed",
    ...usage,
    outcome: { ...(usage.outcome ?? {}), ...(reason ? { error: reason } : {}) },
  });
}

/** Close a run as escalated to a human. */
export function escalateRun(db: Db, orgId: string, runId: string, reason?: string, usage: RunUsage = {}): Promise<void> {
  return completeRun(db, orgId, runId, {
    status: "escalated",
    ...usage,
    outcome: { ...(usage.outcome ?? {}), ...(reason ? { reason } : {}) },
  });
}

/** An employee's most recent runs (newest first). */
export async function listRuns(db: Db, orgId: string, employeeId: string, limit = 20): Promise<AiEmployeeRun[]> {
  const { data, error } = await db
    .from("ai_employee_runs")
    .select("*")
    .eq("organization_id", orgId)
    .eq("employee_id", employeeId)
    .order("started_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToRun);
}
