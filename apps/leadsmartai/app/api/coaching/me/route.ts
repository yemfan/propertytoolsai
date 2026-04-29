import { NextResponse } from "next/server";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import { getProgramViews } from "@/lib/coaching-programs/service";
import { COACHING_PROGRAMS } from "@/lib/coaching-programs/programs";
import { loadProgressInput } from "@/lib/coaching-programs/progress.server";
import { computeProgress } from "@/lib/coaching-programs/progress";
import type { AgentPlan } from "@/lib/entitlements/types";

/**
 * GET /api/coaching/me
 *
 * Returns the calling agent's enrollment status for every coaching
 * program, plus the program metadata (name + targets) so the
 * dashboard widget can render without a separate registry call.
 *
 * Failure mode: returns ok=false + empty programs array rather
 * than 5xx so the widget gracefully hides.
 */
export async function GET() {
  try {
    const ctx = await getCurrentAgentContext();
    const plan = normalizeAgentPlan(ctx.planType);

    // Run views + progress-input fetch in parallel — both go to
    // Supabase, no point sequencing.
    const [views, progressInput] = await Promise.all([
      getProgramViews({ agentId: ctx.agentId, plan }),
      loadProgressInput(ctx.agentId),
    ]);

    return NextResponse.json({
      ok: true,
      plan,
      programs: views.map((v) => {
        const meta = COACHING_PROGRAMS[v.programSlug];
        // Progress is per-program because the target differs;
        // the underlying counts are shared.
        const progress = computeProgress(progressInput, {
          annualTransactionTarget: meta.annualTransactionTarget,
          conversionRateTargetPct: meta.conversionRateTargetPct,
        });
        return {
          slug: v.programSlug,
          status: v.status,
          enrolledAt: v.enrolledAt,
          meta: {
            name: meta.name,
            tagline: meta.tagline,
            annualTransactionTarget: meta.annualTransactionTarget,
            conversionRateTargetPct: meta.conversionRateTargetPct,
          },
          progress,
        };
      }),
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, plan: null, programs: [], error: (e as Error).message },
      { status: 200 },
    );
  }
}

/**
 * The agents table's plan_type column predates the AgentPlan
 * union and uses legacy values ('free' | 'pro' | 'elite'). Map
 * to the canonical AgentPlan so the coaching registry can read
 * eligibility consistently.
 */
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
