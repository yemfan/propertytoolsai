import { NextResponse } from "next/server";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import { checkDashboardSchemaHealth } from "@/lib/health/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/health/migrations
 *
 * Reports whether every table/view the agent-portal dashboard relies on is
 * reachable, and names the migration file that would fix anything missing.
 * Intended for operators — surfacing schema state in a single curl saves
 * triage time when a deploy pulls ahead of the DB.
 *
 * Auth: requires a valid agent session. This surface leaks which relations
 * the backend knows about, which is low-sensitivity but not something to
 * expose anonymously.
 *
 * Response status:
 *   200 when every required relation is present.
 *   503 when one or more is missing — so uptime monitors can alert on this.
 *   401 when not signed in.
 */
export async function GET() {
  try {
    await getCurrentAgentContext();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Not authenticated" },
      { status: 401 },
    );
  }

  const report = await checkDashboardSchemaHealth();
  return NextResponse.json(report, { status: report.ok ? 200 : 503 });
}
