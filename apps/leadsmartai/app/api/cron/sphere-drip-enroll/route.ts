import { NextResponse } from "next/server";

import { verifyCronRequest } from "@/lib/cronAuth";
import { runSphereDripEnrollments } from "@/lib/sphereDrip/runEnrollments";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Sphere drip auto-enrollment cron.
 *
 * For each pilot-allowlisted agent (`SPHERE_DRIP_ENABLED_AGENT_IDS`):
 *   1. Pulls the both_high cohort from the sphere-monetization view
 *   2. Inserts active enrollments for any contact not already enrolled
 *   3. Auto-exits any active enrollment whose contact has dropped out
 *
 * Schedule (vercel.json): 10:00 UTC daily — runs 1 hour after the
 * existing sphere-scheduler so monetization scores are fresh.
 *
 * The send pipeline (advancing steps + queuing the actual SMS/email)
 * is not wired in this PR — that's a follow-up. This cron only
 * manages enrollment. Agents act on `next_due_at` manually for now,
 * surfaced via the monetization panel's per-row enrollment badge.
 *
 * Query overrides for manual testing:
 *   ?agentId=<id>     limit to one agent (still gated by allowlist
 *                     unless ?force=1 is also set)
 *   ?force=1          process even agents not in the allowlist
 *   ?dryRun=1         compute + count, skip writes
 */
export async function GET(req: Request) {
  if (!verifyCronRequest(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  try {
    const url = new URL(req.url);
    const agentId = url.searchParams.get("agentId") ?? undefined;
    const dryRun = url.searchParams.get("dryRun") === "1";
    const forceProcess = url.searchParams.get("force") === "1";

    const result = await runSphereDripEnrollments({ agentId, dryRun, forceProcess });

    // Compact per-agent payload for big fleets — full detail still in logs.
    const compactPerAgent =
      result.perAgent.length > 25
        ? result.perAgent.slice(0, 25).concat([
            {
              agentId: "__truncated__",
              ok: true,
              error: `truncated: ${result.perAgent.length - 25} more results in logs`,
              bothHighEligible: 0,
              alreadyEnrolled: 0,
              newlyEnrolled: 0,
              exited: 0,
            },
          ])
        : result.perAgent;

    return NextResponse.json({
      ok: true,
      agentsConsidered: result.agentsConsidered,
      agentsProcessed: result.agentsProcessed,
      dryRun,
      perAgent: compactPerAgent,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("cron/sphere-drip-enroll", e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
