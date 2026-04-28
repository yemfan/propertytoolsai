import { NextResponse } from "next/server";

import { getCurrentAgentContext } from "@/lib/dashboardService";
import { getRoutingPoolRoster } from "@/lib/leadAssignment/adminService";

export const runtime = "nodejs";

/**
 * GET /api/dashboard/admin/lead-routing
 *
 * Read-only roster of every agent in the IDX lead-routing pool — DB
 * rules + env allowlist union, with last-assignment + recent-count
 * activity per agent. Auth via getCurrentAgentContext (any authed
 * agent can see the pool roster — operational data, not sensitive).
 */
export async function GET() {
  try {
    await getCurrentAgentContext(); // 401s if unauthed
    const result = await getRoutingPoolRoster();
    return NextResponse.json({ ok: true, ...result });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
