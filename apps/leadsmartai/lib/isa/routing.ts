/**
 * Pure ISA-aware routing helpers.
 *
 * The standard team router (#192 lib/leadAssignment/teamRouting)
 * round-robins across all opted-in members. ISA workflows want
 * to TRY ISAs FIRST — every new lead goes to an ISA so they can
 * call within minutes. The qualified leads then get handed off
 * to a closer ('member') via lib/isa/handoff.
 *
 * This module wraps the existing pickNextAgent picker with a
 * role filter. Two functions:
 *   - pickNextIsa(members, lastAssignedAt) — round-robin within
 *     ISAs, returns null when no ISAs in the pool
 *   - pickNextCloser(members, lastAssignedAt) — round-robin
 *     within 'member' (and optionally 'owner') closers
 *
 * Pure — vitest hits each branch.
 */

import { pickNextAgent } from "@/lib/leadAssignment/pickNextAgent";

export type TeamMemberRole = "owner" | "member" | "isa";

export type TeamRoutingMember = {
  agentId: string;
  role: TeamMemberRole;
  /** True iff this member opted into the routing pool. */
  inRoundRobin: boolean;
};

/**
 * Round-robin within team members where role='isa' AND opted in.
 * Returns null when no ISAs are in the pool — caller falls back
 * to the standard pickNextCloser path so leads aren't dropped
 * just because the team hasn't hired an ISA yet.
 */
export function pickNextIsa(
  members: ReadonlyArray<TeamRoutingMember>,
  lastAssignedAt: ReadonlyMap<string, string>,
): string | null {
  const eligible = members
    .filter((m) => m.role === "isa" && m.inRoundRobin && m.agentId)
    .map((m) => m.agentId);
  return pickNextAgent(eligible, lastAssignedAt);
}

/**
 * Round-robin within closers (members + owners by default). Used
 * for the handoff target selection AND as the fallback when no
 * ISAs are configured.
 *
 * `includeOwners` defaults true — small teams often have the
 * owner doubling as a closer. Set false when the owner shouldn't
 * be in the rotation.
 */
export function pickNextCloser(
  members: ReadonlyArray<TeamRoutingMember>,
  lastAssignedAt: ReadonlyMap<string, string>,
  opts: { includeOwners?: boolean } = {},
): string | null {
  const includeOwners = opts.includeOwners ?? true;
  const eligible = members
    .filter((m) => {
      if (!m.inRoundRobin || !m.agentId) return false;
      if (m.role === "isa") return false;
      if (m.role === "owner") return includeOwners;
      return true; // 'member'
    })
    .map((m) => m.agentId);
  return pickNextAgent(eligible, lastAssignedAt);
}

/**
 * Top-level lead routing: ISA-first when any ISA exists in the
 * pool, otherwise direct to a closer. Returns the chosen agent
 * id and which role kind they were picked as, so the caller can
 * tell whether a handoff is expected later.
 */
export type RoutingResult = {
  agentId: string;
  pickedAs: "isa" | "closer";
} | null;

export function pickNextForNewLead(
  members: ReadonlyArray<TeamRoutingMember>,
  lastAssignedAt: ReadonlyMap<string, string>,
): RoutingResult {
  const isa = pickNextIsa(members, lastAssignedAt);
  if (isa) return { agentId: isa, pickedAs: "isa" };
  const closer = pickNextCloser(members, lastAssignedAt);
  if (closer) return { agentId: closer, pickedAs: "closer" };
  return null;
}
