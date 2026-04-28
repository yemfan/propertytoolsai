/**
 * Pure handoff state machine for ISA → closer transitions.
 *
 * When an ISA qualifies a lead they "hand off" to a closer who
 * takes over showings + offers. This module decides when a
 * handoff is valid, who it should go to, and what shape the
 * resulting state change has. The DB write happens in
 * lib/isa/service.ts (server-only).
 *
 * Pure — vitest covers each transition + invalid case.
 */

import type { TeamRoutingMember } from "./routing";
import { pickNextCloser } from "./routing";

export type HandoffPlan = {
  fromAgentId: string;
  toAgentId: string;
  /** Why we did this — set to 'qualified' on the happy path; the
   *  contact_event row records this verbatim. Future variants:
   *  'requalification', 'rebalance'. */
  reason: HandoffReason;
};

export type HandoffReason = "qualified" | "rebalance" | "manual";

export type HandoffError =
  | "from_not_isa"
  | "no_eligible_closer"
  | "from_equals_to";

export type HandoffResult =
  | { ok: true; plan: HandoffPlan }
  | { ok: false; reason: HandoffError };

/**
 * Decide whether a handoff is valid + pick the receiving closer.
 *
 * Inputs:
 *   - currentAssignee: the ISA who currently owns the contact
 *   - members: the team's full roster + their roles + opt-in flag
 *   - lastAssignedAt: per-agent last-assigned timestamp (same
 *     shape pickNextAgent expects); the receiving closer is
 *     picked round-robin
 *   - reason: tags the resulting event for analytics
 */
export function planHandoff(args: {
  currentAssignee: { agentId: string; role: TeamRoutingMember["role"] };
  members: ReadonlyArray<TeamRoutingMember>;
  lastAssignedAt: ReadonlyMap<string, string>;
  reason?: HandoffReason;
}): HandoffResult {
  // Manual handoffs from a non-ISA (e.g. owner reassigning) are
  // allowed but tagged with reason='manual' by the caller. The
  // automatic 'qualified' path requires the from-side to be an
  // ISA.
  const reason = args.reason ?? "qualified";
  if (reason === "qualified" && args.currentAssignee.role !== "isa") {
    return { ok: false, reason: "from_not_isa" };
  }

  const target = pickNextCloser(args.members, args.lastAssignedAt);
  if (!target) {
    return { ok: false, reason: "no_eligible_closer" };
  }

  if (target === args.currentAssignee.agentId) {
    // Pathological: the only "closer" the picker found is the same
    // agent we're trying to hand off from. That happens when the
    // ISA also has role='member' on a different team or when the
    // pool is misconfigured. Refuse rather than no-op.
    return { ok: false, reason: "from_equals_to" };
  }

  return {
    ok: true,
    plan: {
      fromAgentId: args.currentAssignee.agentId,
      toAgentId: target,
      reason,
    },
  };
}
