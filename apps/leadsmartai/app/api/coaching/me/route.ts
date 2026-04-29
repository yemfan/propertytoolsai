import { NextResponse } from "next/server";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import {
  autoEnrollForPlan,
  getProgramViews,
} from "@/lib/coaching-programs/service";
import {
  agentPlanFromStoredPlan,
  COACHING_PROGRAMS,
} from "@/lib/coaching-programs/programs";
import { loadProgressInput } from "@/lib/coaching-programs/progress.server";
import { computeProgress } from "@/lib/coaching-programs/progress";

/**
 * GET /api/coaching/me
 *
 * Returns the calling agent's enrollment status for every coaching
 * program, plus the program metadata (name + targets) so the
 * dashboard widget can render without a separate registry call.
 *
 * Side-effect: runs an idempotent `autoEnrollForPlan` pass before
 * the views read so historical users (who upgraded before the
 * Stripe-webhook hook in `stripeSubscriptionApply.ts` landed) still
 * get caught up on every dashboard mount. The pure pass is a no-op
 * when nothing needs enrolling, so we sequence it before the views
 * fetch — otherwise getProgramViews could miss freshly-inserted
 * enrollment rows.
 *
 * Failure mode: returns ok=false + empty programs array rather
 * than 5xx so the widget gracefully hides.
 */
export async function GET() {
  try {
    const ctx = await getCurrentAgentContext();
    const plan = agentPlanFromStoredPlan(ctx.planType);

    // Idempotent backstop — catches agents who upgraded before the
    // webhook hook landed. Service-layer errors are logged and
    // swallowed inside autoEnrollForPlan so the read still succeeds.
    if (plan) {
      await autoEnrollForPlan({ agentId: ctx.agentId, plan });
    }

    // Views + progress-input run in parallel — both hit Supabase
    // and are independent of each other once enrollments are
    // settled.
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
