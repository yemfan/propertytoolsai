import { NextResponse } from "next/server";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import {
  CoachingEnrollmentError,
  enroll,
} from "@/lib/coaching-programs/service";
import { PROGRAM_ORDER, type ProgramSlug } from "@/lib/coaching-programs/programs";
import type { AgentPlan } from "@/lib/entitlements/types";

export const runtime = "nodejs";

/**
 * POST /api/coaching/programs/:slug/enroll
 *
 * Explicitly enroll the calling agent in a coaching program.
 * Re-enrollment after opt-out also goes through here — the service
 * layer clears `opted_out_at` on conflict.
 *
 * Auth: caller must be the agent (no admin override). Plan
 * eligibility is enforced by `enroll()` and surfaces as a 403 with
 * a "plan_not_eligible" code.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug: rawSlug } = await params;
  if (!isProgramSlug(rawSlug)) {
    return NextResponse.json(
      { ok: false, error: "unknown_program" },
      { status: 404 },
    );
  }

  try {
    const ctx = await getCurrentAgentContext();
    const plan = normalizeAgentPlan(ctx.planType);
    const row = await enroll({
      agentId: ctx.agentId,
      plan,
      programSlug: rawSlug,
    });
    return NextResponse.json({ ok: true, enrollment: row });
  } catch (e) {
    if (e instanceof CoachingEnrollmentError) {
      const status = e.code === "plan_not_eligible" ? 403 : 400;
      return NextResponse.json(
        { ok: false, error: e.code, message: e.message },
        { status },
      );
    }
    return NextResponse.json(
      { ok: false, error: "enroll_failed", message: (e as Error).message },
      { status: 500 },
    );
  }
}

function isProgramSlug(s: string): s is ProgramSlug {
  return (PROGRAM_ORDER as string[]).includes(s);
}

function normalizeAgentPlan(raw: string | null | undefined): AgentPlan | null {
  switch (raw) {
    case "starter":
    case "free":
      return "starter";
    case "pro":
    case "growth":
      return "growth";
    case "elite":
    case "premium":
      return "elite";
    case "team":
      return "team";
    default:
      return null;
  }
}
