import { NextResponse } from "next/server";

import { verifyCronRequest } from "@/lib/cronAuth";
import { runSphereDripSends } from "@/lib/sphereDrip/runSends";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Sphere drip SEND cron — companion to /api/cron/sphere-drip-enroll.
 *
 * Walks every agent in the SPHERE_DRIP_ENABLED_AGENT_IDS allowlist that
 * has at least one due active enrollment, renders the current step,
 * inserts a `message_drafts` row, and advances `current_step` +
 * `next_due_at`. Actual SMS / email delivery rides the existing
 * /api/cron/sphere-drafts-sender pipeline (every 15 min) which honors
 * all timing guardrails (quiet hours, per-contact cap, DNC, etc.).
 *
 * Schedule (vercel.json): hourly at :05 — leaves room for the daily
 * sphere-drip-enroll at 10:00 UTC to land first, then sends pick up
 * within the hour.
 *
 * Query overrides for manual testing:
 *   ?agentId=<id>     limit to one agent (still gated by allowlist
 *                     unless ?force=1 is also set)
 *   ?force=1          process even agents not in the allowlist
 *   ?dryRun=1         compute outcomes, skip writes
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

    const result = await runSphereDripSends({ agentId, dryRun, forceProcess });

    // Compact per-agent payload for big fleets — full detail in logs.
    const compactPerAgent =
      result.perAgent.length > 25
        ? result.perAgent.slice(0, 25).concat([
            {
              agentId: "__truncated__",
              ok: true,
              error: `truncated: ${result.perAgent.length - 25} more results in logs`,
              due: 0,
              drafted: 0,
              skipped: 0,
              exited: 0,
              completed: 0,
              outcomes: [],
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
    console.error("cron/sphere-drip-send", e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
