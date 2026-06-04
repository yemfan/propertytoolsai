/**
 * Autonomy gating for AI employees.
 *
 * Reads permissions.autonomy from the employee record and routes the proposed
 * work accordingly:
 *
 *   autonomous       → execute inside executeRun; returns "executed"
 *   act_with_approval → insert ai_employee_approvals + escalateRun + notify owner;
 *                       returns "escalated". The owner's approve action runs the tool.
 *   suggest          → no side effects; returns "skipped"
 *
 * The caller supplies `execute(runId)` — the actual work callback. For
 * autonomous employees this is called with a fresh run id. For others it is
 * never called (the run is opened + immediately escalated/closed instead).
 *
 * Best-effort: errors inside `execute` are caught and close the run as "failed";
 * errors in the gating infrastructure itself are always rethrown (they indicate
 * a config problem, not a transient failure).
 */

import { createNotificationService } from "@/lib/actions/notifications";
import {
  getEmployee,
  startRun,
  escalateRun,
  failRun,
  type StartRunInput,
  type RunUsage,
} from "@helm/ai-workforce";
import type { SupabaseClient } from "@supabase/supabase-js";

type Db = SupabaseClient;

export type GatingStatus = "executed" | "escalated" | "skipped" | "no_employee";

export interface GatingResult {
  status: GatingStatus;
  runId?: string;
  approvalId?: string;
  /** The value returned by execute() on success. */
  value?: unknown;
}

export interface GatingOptions {
  /** The work to run for autonomous employees. Must return RunUsage (tokens/cost/outcome). */
  execute: (runId: string) => Promise<RunUsage & { value?: unknown }>;
  /** StartRunInput fields beyond employeeId (channel, subjectType, subjectId). */
  runInput: Omit<StartRunInput, "employeeId">;
  /** Context shown to the owner in the approval notification. */
  approvalSubject: Record<string, unknown>;
  /** Which tool the employee wants to invoke (for act_with_approval queue). */
  toolKey: string;
  /** The tool's input arguments (stored in the approval row). */
  toolInput: Record<string, unknown>;
  /** Human-readable description for the owner notification. */
  description: string;
}

/**
 * Enforce the employee's autonomy level and run (or queue) the work.
 *
 * Falls back to "no_employee" (without throwing) if the org hasn't seeded its
 * workforce yet or Emma is paused/draft — the caller should handle this gracefully
 * (e.g. fall back to the legacy non-engine path).
 */
export async function enforceAutonomy(
  db: Db,
  orgId: string,
  employeeSlug: string,
  opts: GatingOptions,
): Promise<GatingResult> {
  const employee = await getEmployee(db, orgId, employeeSlug);
  if (!employee || employee.status !== "active") {
    return { status: "no_employee" };
  }

  const autonomy = employee.permissions.autonomy ?? "autonomous";

  // ── suggest: propose only, no execution ──────────────────────────────────
  if (autonomy === "suggest") {
    return { status: "skipped" };
  }

  // ── act_with_approval: queue + escalate ───────────────────────────────────
  if (autonomy === "act_with_approval") {
    const runId = await startRun(db, orgId, { employeeId: employee.id, ...opts.runInput });
    const { data: approvalRow } = await db.from("ai_employee_approvals").insert({
      organization_id: orgId,
      employee_id: employee.id,
      run_id: runId,
      channel: opts.runInput.channel ?? null,
      subject: opts.approvalSubject,
      tool_key: opts.toolKey,
      tool_input: opts.toolInput,
      status: "pending",
    }).select("id").single();
    await escalateRun(db, orgId, runId, `Waiting for owner approval: ${opts.toolKey}`);
    await createNotificationService(orgId, {
      type: "new_message",
      title: `${employee.name} needs your approval`,
      body: opts.description.slice(0, 120),
      link: "/approvals",
    });
    return { status: "escalated", runId, approvalId: approvalRow?.id as string | undefined };
  }

  // ── autonomous: execute inside a tracked run ──────────────────────────────
  const runId = await startRun(db, orgId, { employeeId: employee.id, ...opts.runInput });
  try {
    const { value, ...usage } = await opts.execute(runId);
    // completeRun is called by the execute callback via executeRun — or explicitly
    // here if the caller opted for the thin gating path (no executeRun nesting).
    // We call it here to guarantee closure; if it was already called inside
    // executeRun, Supabase will overwrite with the same final status — harmless.
    const { completeRun } = await import("@helm/ai-workforce");
    await completeRun(db, orgId, runId, { status: "succeeded", ...usage });
    return { status: "executed", runId, value };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await failRun(db, orgId, runId, msg);
    return { status: "executed", runId }; // still "executed" (attempted); error logged in run
  }
}
