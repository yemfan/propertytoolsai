/**
 * Pure helpers for the team-aggregated reporting surface (PR-AA7).
 *
 * Team owners need per-member visibility on top of the roll-up
 * numbers from PR-AA6. "Member A: 12 leads / 4 closed; Member B: 8
 * leads / 2 closed" — answer the "who's contributing what" question
 * without bouncing the owner through 4 different pages.
 *
 * Pure module so vitest hits it without Supabase. The async fetcher
 * in `breakdown.server.ts` runs the per-agent count queries and
 * feeds the rows into `buildTeamBreakdown`.
 */

import type { TeamRole } from "./types";

export type MemberMetrics = {
  /** Active contacts (lifecycle != archived). */
  contactsTotal: number;
  /** Contacts with rating='hot'. */
  leadsHot: number;
  /** Tasks with status='done' completed in the last 30 days. */
  tasksCompletedLast30d: number;
  /** Tasks with status='open'. */
  tasksOpen: number;
  /** Transactions with status='active'. */
  transactionsActive: number;
  /** Transactions with status='closed', closed in current calendar year. */
  transactionsClosedYtd: number;
};

export type MemberBreakdownRow = MemberMetrics & {
  agentId: string;
  role: TeamRole;
};

export type TeamBreakdown = {
  rows: MemberBreakdownRow[];
  totals: MemberMetrics;
};

/**
 * Assemble the breakdown from per-member metric rows. Sorts:
 *   1. Owner first (always at the top — they "anchor" the team)
 *   2. Then by transactionsClosedYtd desc (the bottom-line metric)
 *   3. Then by contactsTotal desc (volume tie-break)
 *   4. Then agentId asc (deterministic)
 *
 * Computes a totals row by summing all members. Used for the
 * "Team total" row at the bottom of the table.
 */
export function buildTeamBreakdown(
  rows: ReadonlyArray<MemberBreakdownRow>,
): TeamBreakdown {
  const sorted = [...rows].sort((a, b) => {
    if (a.role === "owner" && b.role !== "owner") return -1;
    if (b.role === "owner" && a.role !== "owner") return 1;
    if (a.transactionsClosedYtd !== b.transactionsClosedYtd) {
      return b.transactionsClosedYtd - a.transactionsClosedYtd;
    }
    if (a.contactsTotal !== b.contactsTotal) {
      return b.contactsTotal - a.contactsTotal;
    }
    if (a.agentId < b.agentId) return -1;
    if (a.agentId > b.agentId) return 1;
    return 0;
  });

  const totals = rows.reduce<MemberMetrics>(
    (acc, r) => ({
      contactsTotal: acc.contactsTotal + r.contactsTotal,
      leadsHot: acc.leadsHot + r.leadsHot,
      tasksCompletedLast30d:
        acc.tasksCompletedLast30d + r.tasksCompletedLast30d,
      tasksOpen: acc.tasksOpen + r.tasksOpen,
      transactionsActive: acc.transactionsActive + r.transactionsActive,
      transactionsClosedYtd:
        acc.transactionsClosedYtd + r.transactionsClosedYtd,
    }),
    {
      contactsTotal: 0,
      leadsHot: 0,
      tasksCompletedLast30d: 0,
      tasksOpen: 0,
      transactionsActive: 0,
      transactionsClosedYtd: 0,
    },
  );

  return { rows: sorted, totals };
}

/** Empty metric row used for fallbacks + tests. */
export const EMPTY_MEMBER_METRICS: MemberMetrics = {
  contactsTotal: 0,
  leadsHot: 0,
  tasksCompletedLast30d: 0,
  tasksOpen: 0,
  transactionsActive: 0,
  transactionsClosedYtd: 0,
};
