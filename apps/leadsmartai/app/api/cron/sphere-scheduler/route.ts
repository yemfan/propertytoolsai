import { NextResponse } from "next/server";
import { verifyCronRequest } from "@/lib/cronAuth";
import { runScheduler } from "@/lib/scheduler";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Sphere trigger scheduler — walks every agent's contact list and fires
 * anniversary / equity / dormancy / quarterly triggers, dedup'd via
 * trigger_firings. Daily cron is fine for date- and threshold-based
 * triggers; event-based ones (new lead, refi detected) are driven by
 * external listeners, not this cron.
 *
 *   Daily at 09:00 UTC:
 *     - anniversary windows (14 days forward / 7 back)
 *     - equity milestones (once_per_milestone)
 *     - dormancy (120d threshold)
 *     - quarterly equity (first 14 days of the quarter)
 */
export async function GET(req: Request) {
  if (!verifyCronRequest(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  try {
    const url = new URL(req.url);
    const agentId = url.searchParams.get("agentId") ?? undefined;
    const dryRun = url.searchParams.get("dryRun") === "1";
    const result = await runScheduler({ agentId, dryRun });
    return NextResponse.json({ ok: true, ...result });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("cron/sphere-scheduler", e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
