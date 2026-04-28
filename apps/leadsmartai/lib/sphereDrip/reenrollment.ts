import type { DripEnrollmentRow } from "./attach";

/**
 * Pure decider for whether an EXISTING enrollment row should be
 * re-activated when its contact re-enters the both_high cohort.
 *
 * Lives in its own file (no `server-only`) so vitest can hit each
 * branch without supabase mocks. The enrollment service feeds in the
 * prior row + a `nowIso` and acts on the returned decision.
 *
 * v1 cooldown: 30 days. The threshold is generous on purpose —
 * pulling a contact back into a 6-touch cadence right after they
 * either completed it or dropped out feels spammy. Agents who want
 * to re-engage sooner can flip the per-agent toggle off/on or
 * manually re-enroll a single contact (future PR — today no manual
 * re-enroll endpoint exists).
 *
 * Status semantics:
 *   active     — already in the cadence, nothing to decide
 *   paused     — agent manually held; re-enrollment requires their
 *                explicit action, not an auto-trigger
 *   completed  — finished all 6 steps; eligible for re-run after
 *                cooldown anchored on completed_at
 *   exited     — left the cohort; eligible after cooldown anchored
 *                on updated_at (the row's exit timestamp)
 */

export const REENROLLMENT_COOLDOWN_DAYS = 30;

export type ReenrollmentDecision =
  | { kind: "reenroll"; anchorIso: string }
  | {
      kind: "skip";
      reason:
        | "still_active"
        | "manually_paused"
        | "cooldown_not_elapsed"
        | "missing_anchor";
    };

export type DecideReenrollmentInput = {
  prior: DripEnrollmentRow;
  /** ISO timestamp the runner is using as "now". Service passes the
   *  same value it uses for nextDueAt computation so a single tick is
   *  consistent with itself. */
  nowIso: string;
  /** Override for tests; defaults to the v1 constant. */
  cooldownDays?: number;
};

export function decideReenrollment(input: DecideReenrollmentInput): ReenrollmentDecision {
  const cooldownDays = input.cooldownDays ?? REENROLLMENT_COOLDOWN_DAYS;

  if (input.prior.status === "active") {
    return { kind: "skip", reason: "still_active" };
  }
  if (input.prior.status === "paused") {
    // Manual pause is sticky. Agent must un-pause via the (future)
    // per-row UI; we never auto-revive a paused enrollment.
    return { kind: "skip", reason: "manually_paused" };
  }

  const anchorIso = pickAnchor(input.prior);
  if (!anchorIso) {
    return { kind: "skip", reason: "missing_anchor" };
  }

  const elapsedMs = Date.parse(input.nowIso) - Date.parse(anchorIso);
  if (!Number.isFinite(elapsedMs)) {
    return { kind: "skip", reason: "missing_anchor" };
  }
  const cooldownMs = cooldownDays * 86_400_000;
  if (elapsedMs < cooldownMs) {
    return { kind: "skip", reason: "cooldown_not_elapsed" };
  }

  return { kind: "reenroll", anchorIso };
}

/**
 * Pick the timestamp the cooldown is measured from:
 *   completed → completedAt (when the cadence finished)
 *   exited    → enrollment.updatedAt fallback (set by the trigger
 *                when the runner stamped status='exited')
 *
 * For exited rows we don't have a dedicated `exited_at` column today.
 * Adding one is overkill since exited rows are terminal — nothing
 * else updates them after the exit, so updated_at IS the exit time.
 */
function pickAnchor(prior: DripEnrollmentRow): string | null {
  if (prior.status === "completed") return prior.completedAt ?? prior.updatedAt ?? null;
  if (prior.status === "exited") return prior.updatedAt ?? prior.completedAt ?? null;
  return null;
}

/**
 * Computes the patch that re-enrolls a prior row in place. Pure —
 * caller applies the patch via the persistence layer. Returns the
 * EXACT shape needed to flip the row back to a fresh active state:
 *
 *   * status → 'active'
 *   * current_step → 0
 *   * enrolled_at → nowIso (this is a NEW run; the original
 *                            enrollment is part of the audit trail
 *                            but the cadence anchors on the new
 *                            enroll date)
 *   * last_sent_at → null
 *   * completed_at → null
 *   * exit_reason → null
 *   * next_due_at — caller sets via computeNextDueAt(cadence, 0,
 *                    nowIso, null)
 */
export function buildReenrollmentPatch(args: {
  nowIso: string;
  nextDueAt: string | null;
}): Record<string, unknown> {
  return {
    status: "active",
    current_step: 0,
    enrolled_at: args.nowIso,
    last_sent_at: null,
    completed_at: null,
    exit_reason: null,
    next_due_at: args.nextDueAt,
  };
}
