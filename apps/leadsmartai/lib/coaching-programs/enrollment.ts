/**
 * Pure enrollment-state logic for LeadSmart AI Coaching.
 *
 * The runtime question this module answers: given an agent's
 * plan + their current enrollment rows, what's their effective
 * status for each program — enrolled / opted_out / not_eligible /
 * eligible_not_enrolled?
 *
 * Pure — vitest hits each branch.
 */

import type { AgentPlan } from "@/lib/entitlements/types";
import {
  canPlanAccessProgram,
  planAutoEnrollsProgram,
  PROGRAM_ORDER,
  type ProgramSlug,
} from "./programs";

export type EnrollmentRow = {
  programSlug: ProgramSlug;
  enrolledAt: string;
  optedOutAt: string | null;
};

export type ProgramStatus =
  | "enrolled"
  | "opted_out"
  | "eligible_not_enrolled"
  | "not_eligible";

export type ProgramView = {
  programSlug: ProgramSlug;
  status: ProgramStatus;
  enrolledAt: string | null;
  optedOutAt: string | null;
};

/**
 * Resolve every program's status for an agent. Returns one entry
 * per program in PROGRAM_ORDER so the UI can render a stable list
 * regardless of how many enrollment rows exist.
 */
export function resolveProgramStatuses(args: {
  plan: AgentPlan | null;
  enrollments: ReadonlyArray<EnrollmentRow>;
}): ProgramView[] {
  const byProgram = new Map<ProgramSlug, EnrollmentRow>();
  for (const e of args.enrollments) byProgram.set(e.programSlug, e);

  return PROGRAM_ORDER.map((slug): ProgramView => {
    const row = byProgram.get(slug);
    const eligible = canPlanAccessProgram({ plan: args.plan, program: slug });
    if (!eligible) {
      return {
        programSlug: slug,
        status: "not_eligible",
        enrolledAt: null,
        optedOutAt: row?.optedOutAt ?? null,
      };
    }
    if (!row) {
      return {
        programSlug: slug,
        status: "eligible_not_enrolled",
        enrolledAt: null,
        optedOutAt: null,
      };
    }
    if (row.optedOutAt) {
      return {
        programSlug: slug,
        status: "opted_out",
        enrolledAt: row.enrolledAt,
        optedOutAt: row.optedOutAt,
      };
    }
    return {
      programSlug: slug,
      status: "enrolled",
      enrolledAt: row.enrolledAt,
      optedOutAt: null,
    };
  });
}

export type AutoEnrollPlan = {
  /** Programs to add a fresh enrollment for. */
  enroll: ProgramSlug[];
  /** Programs to leave alone (already enrolled, or previously
   *  opted out — we never re-enroll the agent automatically). */
  skip: Array<{ slug: ProgramSlug; reason: AutoEnrollSkipReason }>;
};

export type AutoEnrollSkipReason =
  | "not_eligible"
  | "already_enrolled"
  | "previously_opted_out"
  | "plan_does_not_auto_enroll";

/**
 * Given the agent's current plan + existing enrollment rows,
 * decide which programs to auto-enroll them in. Idempotent —
 * calling this on every login/plan-change is safe.
 *
 * Rules:
 *   - Plan must auto-enroll the program (planAutoEnrollsProgram)
 *   - No existing row for that program (idempotent on re-runs)
 *   - Agent has NOT previously opted out (we respect their choice
 *     and require explicit re-enrollment)
 */
export function planAutoEnrollment(args: {
  plan: AgentPlan | null;
  existing: ReadonlyArray<EnrollmentRow>;
}): AutoEnrollPlan {
  const byProgram = new Map<ProgramSlug, EnrollmentRow>();
  for (const e of args.existing) byProgram.set(e.programSlug, e);

  const enroll: ProgramSlug[] = [];
  const skip: AutoEnrollPlan["skip"] = [];

  for (const slug of PROGRAM_ORDER) {
    if (!canPlanAccessProgram({ plan: args.plan, program: slug })) {
      skip.push({ slug, reason: "not_eligible" });
      continue;
    }
    if (!planAutoEnrollsProgram({ plan: args.plan, program: slug })) {
      skip.push({ slug, reason: "plan_does_not_auto_enroll" });
      continue;
    }
    const existing = byProgram.get(slug);
    if (existing && !existing.optedOutAt) {
      skip.push({ slug, reason: "already_enrolled" });
      continue;
    }
    if (existing && existing.optedOutAt) {
      skip.push({ slug, reason: "previously_opted_out" });
      continue;
    }
    enroll.push(slug);
  }

  return { enroll, skip };
}
