import { NextResponse } from "next/server";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import { runScheduler } from "@/lib/scheduler";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * On-demand scheduler run for the current agent only. Used by the "Preview /
 * Run scheduler" action on /dashboard/drafts so agents can see what would fire
 * and create the drafts without waiting for the daily cron.
 */
export async function POST(req: Request) {
  try {
    const { agentId } = await getCurrentAgentContext();
    const body = (await req.json().catch(() => ({}))) as { dryRun?: boolean };
    const result = await runScheduler({
      agentId,
      dryRun: Boolean(body.dryRun),
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("dashboard/scheduler/run", e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
