// The orchestrator that makes the runtime a "runtime": wrap any unit of employee work
// with run accounting. Open a run, hand the work a ToolContext (db/orgId/employeeId/
// runId) so it can dispatch tools and remember facts, then close the run as succeeded
// or failed. An app's agent loop calls executeRun and does its LLM + tool-calling
// inside `work`; everything it does is attributed to one run row.

import type { RunStatus } from "./types";
import type { Db } from "./db";
import { startRun, completeRun, type StartRunInput, type RunUsage } from "./runs";
import type { ToolContext } from "./tools";

export type ExecuteRunInput = StartRunInput;

/** What `work` returns: its result value plus optional run usage (outcome/tokens/cost). */
export type WorkResult<T> = { value: T } & RunUsage;

export interface RunResult<T> {
  runId: string;
  status: RunStatus;
  value?: T;
  error?: string;
}

/**
 * Run `work` inside a tracked run. On return, the run is closed "succeeded" with the
 * work's usage; on throw, it's closed "failed" with the error in outcome.error and the
 * error is rethrown (pass rethrow:false to swallow and get {status:"failed"} back).
 */
export async function executeRun<T>(
  db: Db,
  orgId: string,
  input: ExecuteRunInput,
  work: (ctx: ToolContext) => Promise<WorkResult<T>>,
  opts: { rethrow?: boolean } = {}
): Promise<RunResult<T>> {
  const runId = await startRun(db, orgId, input);
  const ctx: ToolContext = { db, orgId, employeeId: input.employeeId, runId };
  try {
    const { value, ...usage } = await work(ctx);
    await completeRun(db, orgId, runId, { status: "succeeded", ...usage });
    return { runId, status: "succeeded", value };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await completeRun(db, orgId, runId, { status: "failed", outcome: { error: message } });
    if (opts.rethrow !== false) throw e;
    return { runId, status: "failed", error: message };
  }
}
