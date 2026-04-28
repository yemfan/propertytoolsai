/**
 * Pure seat-cap math for team accounts.
 *
 * The owner's plan defines `teamSeatCap` (see planCatalog.ts):
 *   - 0 means the plan can't host a team (Starter / Pro)
 *   - N means up to N members including the owner
 *   - null means unlimited
 *
 * Pending invites count toward the cap so the owner can't
 * oversubscribe by sending many invites at once and waiting for
 * acceptances. When an invite expires unaccepted, its seat frees
 * up automatically (the helper filters by expiry + accepted_at).
 *
 * Lives without `server-only` so vitest hits it directly. The
 * caller in `seatLimits.server.ts` reads the team roster + invites
 * and feeds the counts into `computeSeatUsage`.
 */

export type SeatUsage = {
  /** Currently-occupied seats: members + active invites. */
  used: number;
  /** Plan-defined cap. Null means unlimited. */
  cap: number | null;
  /** Seats still available. Null when cap is null. */
  available: number | null;
  /** True when the team is at or beyond cap. False if cap is null. */
  full: boolean;
};

export type SeatUsageInput = {
  /** team_memberships row count for this team. */
  memberCount: number;
  /** team_invites rows where accepted_at IS NULL AND expires_at > now. */
  activeInviteCount: number;
  /** From the owner's plan catalog entry. Null = unlimited. */
  cap: number | null;
};

export function computeSeatUsage(input: SeatUsageInput): SeatUsage {
  const used = Math.max(0, input.memberCount) + Math.max(0, input.activeInviteCount);
  if (input.cap == null) {
    return { used, cap: null, available: null, full: false };
  }
  const available = Math.max(0, input.cap - used);
  return {
    used,
    cap: input.cap,
    available,
    full: used >= input.cap,
  };
}

/**
 * Decide whether one more invite can be accepted right now. Pure
 * predicate the service layer uses before calling the DB.
 */
export function canAcceptOneMoreSeat(usage: SeatUsage): boolean {
  if (usage.cap == null) return true;
  return usage.used < usage.cap;
}
