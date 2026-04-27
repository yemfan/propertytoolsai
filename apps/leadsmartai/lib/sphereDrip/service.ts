import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { filterMonetizationRows } from "@/lib/sphereMonetization/mergeRows";
import { fetchMonetizationViewForAgent } from "@/lib/sphereMonetization/service";

import {
  attachEnrollments,
  indexEnrollmentsByContact,
  type DripEnrollmentRow,
  type MonetizationRowWithEnrollment,
} from "./attach";
import {
  BOTH_HIGH_CADENCE,
  BOTH_HIGH_CADENCE_KEY,
  computeNextDueAt,
  DRIP_ELIGIBLE_LIFECYCLES,
  type DripCadence,
} from "./cadence";

/**
 * Auto-enrollment + visibility service for the sphere drip.
 *
 * Two responsibilities:
 *   1. enrollEligibleContactsForAgent() — runs nightly via cron. Pulls
 *      the both_high cohort from the existing monetization view and
 *      upserts an active enrollment row per contact. Idempotent —
 *      contacts already enrolled stay in their current state.
 *   2. listEnrollmentsForAgent() — read-side helper used by the
 *      monetization panel to overlay enrollment status on each row.
 *
 * Send pipeline (the actual SMS/email touch on next_due_at) is OUT OF
 * SCOPE here. That's a follow-up that hooks into the existing scheduler
 * + drafts pipeline. The cron in this PR only manages enrollment.
 */

export type EnrollmentRunResult = {
  bothHighEligible: number;
  alreadyEnrolled: number;
  newlyEnrolled: number;
  exited: number;
};

/**
 * Pull current both_high cohort, ensure each is enrolled, and exit any
 * existing enrollments whose contact has dropped out of both_high.
 *
 * Idempotent. Safe to run multiple times per day — the upsert dedups
 * via the (agent_id, contact_id, cadence_key) unique index.
 */
export async function enrollEligibleContactsForAgent(
  agentId: string,
  opts: { dryRun?: boolean; nowIso?: string } = {},
): Promise<EnrollmentRunResult> {
  const nowIso = opts.nowIso ?? new Date().toISOString();
  const dryRun = Boolean(opts.dryRun);

  const monetization = await fetchMonetizationViewForAgent(agentId);
  const eligibleRows = filterMonetizationRows(monetization, "both_high").filter(
    (r) =>
      DRIP_ELIGIBLE_LIFECYCLES.includes(r.lifecycleStage) &&
      r.contactId &&
      r.contactId.length > 0,
  );

  // Existing enrollments for this agent + cadence — used to figure out
  // who's new vs. who's already in the loop, and who needs auto-exit.
  const existing = await listEnrollmentsForAgent(agentId, BOTH_HIGH_CADENCE_KEY);
  const existingByContactId = new Map(existing.map((e) => [e.contactId, e]));
  const eligibleContactIds = new Set(eligibleRows.map((r) => r.contactId));

  const result: EnrollmentRunResult = {
    bothHighEligible: eligibleRows.length,
    alreadyEnrolled: 0,
    newlyEnrolled: 0,
    exited: 0,
  };

  // 1. Newly-eligible contacts → insert active enrollment.
  for (const row of eligibleRows) {
    const prior = existingByContactId.get(row.contactId);
    if (prior) {
      // Already enrolled. If they were exited and re-entered both_high,
      // we leave them exited — re-enrollment is a follow-up nuance.
      result.alreadyEnrolled += 1;
      continue;
    }
    if (dryRun) {
      result.newlyEnrolled += 1;
      continue;
    }
    const nextDueAt = computeNextDueAt(BOTH_HIGH_CADENCE, 0, nowIso, null);
    const { error } = await supabaseAdmin.from("sphere_drip_enrollments").insert({
      agent_id: agentId,
      contact_id: row.contactId,
      cadence_key: BOTH_HIGH_CADENCE_KEY,
      enrolled_at: nowIso,
      current_step: 0,
      status: "active",
      next_due_at: nextDueAt,
    });
    if (error) {
      // Race with a concurrent run — the unique index will reject the
      // dup. Treat as already-enrolled rather than failing the whole run.
      if (error.code === "23505") {
        result.alreadyEnrolled += 1;
      } else {
        throw new Error(`Failed to insert enrollment: ${error.message}`);
      }
    } else {
      result.newlyEnrolled += 1;
    }
  }

  // 2. Active enrollments whose contact has dropped out of both_high → exit.
  const toExit = existing.filter(
    (e) => e.status === "active" && !eligibleContactIds.has(e.contactId),
  );
  for (const e of toExit) {
    if (dryRun) {
      result.exited += 1;
      continue;
    }
    const { error } = await supabaseAdmin
      .from("sphere_drip_enrollments")
      .update({
        status: "exited",
        exit_reason: "left_both_high_cohort",
      })
      .eq("id", e.id);
    if (error) {
      throw new Error(`Failed to exit enrollment ${e.id}: ${error.message}`);
    }
    result.exited += 1;
  }

  return result;
}

/**
 * List all enrollments for an agent (optionally scoped to a cadence).
 * Used by the monetization panel to overlay enrollment status onto each
 * row, and by the auto-enroll runner to compute new vs. existing.
 */
export async function listEnrollmentsForAgent(
  agentId: string,
  cadenceKey?: string,
): Promise<DripEnrollmentRow[]> {
  let query = supabaseAdmin
    .from("sphere_drip_enrollments")
    .select(
      "id, agent_id, contact_id, cadence_key, enrolled_at, current_step, status, last_sent_at, next_due_at, completed_at, exit_reason",
    )
    .eq("agent_id", agentId);
  if (cadenceKey) query = query.eq("cadence_key", cadenceKey);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return ((data ?? []) as Array<{
    id: string;
    agent_id: string | number;
    contact_id: string;
    cadence_key: string;
    enrolled_at: string;
    current_step: number;
    status: string;
    last_sent_at: string | null;
    next_due_at: string | null;
    completed_at: string | null;
    exit_reason: string | null;
  }>).map<DripEnrollmentRow>((r) => ({
    id: r.id,
    agentId: String(r.agent_id),
    contactId: r.contact_id,
    cadenceKey: r.cadence_key,
    enrolledAt: r.enrolled_at,
    currentStep: r.current_step,
    status: normalizeStatus(r.status),
    lastSentAt: r.last_sent_at,
    nextDueAt: r.next_due_at,
    completedAt: r.completed_at,
    exitReason: r.exit_reason,
  }));
}

function normalizeStatus(raw: string): DripEnrollmentRow["status"] {
  if (raw === "active" || raw === "paused" || raw === "completed" || raw === "exited") {
    return raw;
  }
  return "active";
}

// Re-export so consumers can import everything from one place.
export { BOTH_HIGH_CADENCE, BOTH_HIGH_CADENCE_KEY };
export type { DripCadence };
export {
  attachEnrollments,
  indexEnrollmentsByContact,
};
export type { DripEnrollmentRow, MonetizationRowWithEnrollment };
