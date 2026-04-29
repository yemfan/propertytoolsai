import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import type { AgentPlan } from "@/lib/entitlements/types";
import {
  planAutoEnrollment,
  resolveProgramStatuses,
  type EnrollmentRow,
  type ProgramView,
} from "./enrollment";
import {
  canPlanAccessProgram,
  type ProgramSlug,
} from "./programs";

/**
 * Server-side service for LeadSmart AI Coaching enrollments.
 *
 * Bypasses RLS via the service-role client because routes
 * authorize the calling agent before invoking. The pure logic
 * (program registry + access predicates + auto-enroll plan) is
 * the brains; this layer just persists.
 */

export type CoachingError =
  | "plan_not_eligible"
  | "already_enrolled"
  | "not_enrolled";

export class CoachingEnrollmentError extends Error {
  readonly code: CoachingError;
  constructor(code: CoachingError, message: string) {
    super(message);
    this.code = code;
  }
}

export async function listEnrollments(
  agentId: string,
): Promise<EnrollmentRow[]> {
  const { data } = await supabaseAdmin
    .from("coaching_enrollments")
    .select("program_slug, enrolled_at, opted_out_at")
    .eq("agent_id", agentId);
  return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
}

/**
 * Read-side helper — returns one ProgramView per program for the
 * agent. Use this on the dashboard widget + pricing page CTAs.
 */
export async function getProgramViews(args: {
  agentId: string;
  plan: AgentPlan | null;
}): Promise<ProgramView[]> {
  const enrollments = await listEnrollments(args.agentId);
  return resolveProgramStatuses({ plan: args.plan, enrollments });
}

/**
 * Explicit enrollment by the agent. Re-enrollment after opt-out
 * also goes through here — clears `opted_out_at`. Throws when
 * the plan can't access the program.
 */
export async function enroll(args: {
  agentId: string;
  plan: AgentPlan | null;
  programSlug: ProgramSlug;
  /** Override "now" for tests. */
  nowIso?: string;
}): Promise<EnrollmentRow> {
  if (!canPlanAccessProgram({ plan: args.plan, program: args.programSlug })) {
    throw new CoachingEnrollmentError(
      "plan_not_eligible",
      "Your current plan does not include this coaching program.",
    );
  }
  const nowIso = args.nowIso ?? new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("coaching_enrollments")
    .upsert(
      {
        agent_id: args.agentId,
        program_slug: args.programSlug,
        enrolled_at: nowIso,
        opted_out_at: null,
        opt_out_reason: null,
      },
      { onConflict: "agent_id,program_slug" },
    )
    .select("program_slug, enrolled_at, opted_out_at")
    .single();
  if (error || !data) {
    throw new Error(error?.message ?? "Failed to enroll");
  }
  return mapRow(data as Record<string, unknown>);
}

export async function optOut(args: {
  agentId: string;
  programSlug: ProgramSlug;
  reason?: string | null;
  nowIso?: string;
}): Promise<EnrollmentRow | null> {
  const nowIso = args.nowIso ?? new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("coaching_enrollments")
    .update({
      opted_out_at: nowIso,
      opt_out_reason: args.reason ?? null,
    })
    .eq("agent_id", args.agentId)
    .eq("program_slug", args.programSlug)
    .select("program_slug, enrolled_at, opted_out_at")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) {
    throw new CoachingEnrollmentError(
      "not_enrolled",
      "No enrollment found for this program.",
    );
  }
  return mapRow(data as Record<string, unknown>);
}

/**
 * Idempotent auto-enroll hook. Called on agent signup, on
 * subscription upgrade, and on every dashboard mount to ensure
 * the agent's enrollments match their current plan. Honors prior
 * opt-outs — we don't re-enroll without an explicit choice.
 *
 * Returns the list of programs we actually enrolled the agent
 * in (empty when there was nothing to do, which is the common
 * case on every-mount runs).
 */
export async function autoEnrollForPlan(args: {
  agentId: string;
  plan: AgentPlan | null;
  nowIso?: string;
}): Promise<ProgramSlug[]> {
  const existing = await listEnrollments(args.agentId);
  const plan = planAutoEnrollment({ plan: args.plan, existing });
  if (plan.enroll.length === 0) return [];

  const nowIso = args.nowIso ?? new Date().toISOString();
  const rows = plan.enroll.map((slug) => ({
    agent_id: args.agentId,
    program_slug: slug,
    enrolled_at: nowIso,
    opted_out_at: null,
  }));

  const { error } = await supabaseAdmin
    .from("coaching_enrollments")
    .upsert(rows, { onConflict: "agent_id,program_slug" });
  if (error) {
    console.warn("[coaching] autoEnrollForPlan upsert failed:", error.message);
    return [];
  }
  return plan.enroll;
}

function mapRow(row: Record<string, unknown>): EnrollmentRow {
  return {
    programSlug: (row.program_slug as ProgramSlug) ?? "producer_track",
    enrolledAt: String(row.enrolled_at ?? ""),
    optedOutAt: (row.opted_out_at as string | null) ?? null,
  };
}
