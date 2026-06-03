// Attribute real receptionist work to Emma (the AI Receptionist) in the AI Workforce
// runtime, so the Executive Command Center can show what she actually did. Every
// function here is BEST-EFFORT: it resolves Emma for the org, records to the runtime,
// and swallows all errors — a workforce hiccup must never break a live call or booking.
// If the org hasn't seeded its workforce yet, getEmployee returns null and we no-op.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@helm/data/types";
import { getEmployee, startRun, completeRun, incrementMetric } from "@helm/ai-workforce";

type Db = SupabaseClient<Database>;

const EMMA = "emma";

/** Bump Emma's appointments_booked KPI for one successful receptionist booking. */
export async function recordEmmaBooking(db: Db, orgId: string): Promise<void> {
  try {
    const emma = await getEmployee(db, orgId, EMMA);
    if (!emma) return;
    await incrementMetric(db, orgId, { employeeId: emma.id, metricKey: "appointments_booked" });
  } catch (e) {
    console.error("[workforce] recordEmmaBooking failed:", e);
  }
}

export interface CallAttribution {
  callId: string;
  outcome?: Record<string, unknown>;
}

/**
 * Record a completed inbound call as one of Emma's runs and bump calls_answered.
 * Idempotent on (subject_type="call", subject_id=callId): a re-delivered call_analyzed
 * webhook is skipped, so the run + metric are counted exactly once per call.
 */
export async function attributeCallToEmma(db: Db, orgId: string, args: CallAttribution): Promise<void> {
  try {
    const emma = await getEmployee(db, orgId, EMMA);
    if (!emma) return;

    const { data: already } = await db
      .from("ai_employee_runs")
      .select("id")
      .eq("organization_id", orgId)
      .eq("employee_id", emma.id)
      .eq("subject_type", "call")
      .eq("subject_id", args.callId)
      .maybeSingle();
    if (already) return;

    const runId = await startRun(db, orgId, {
      employeeId: emma.id,
      channel: "voice",
      subjectType: "call",
      subjectId: args.callId,
    });
    await completeRun(db, orgId, runId, { status: "succeeded", outcome: args.outcome ?? {} });
    await incrementMetric(db, orgId, { employeeId: emma.id, metricKey: "calls_answered" });
  } catch (e) {
    console.error("[workforce] attributeCallToEmma failed:", e);
  }
}
