import { NextResponse } from "next/server";

import { getCurrentAgentContext } from "@/lib/dashboardService";
import { listConnectionsForAgent } from "@/lib/social/connectionsService";

export const runtime = "nodejs";

/**
 * GET /api/dashboard/social/connections
 *
 * Returns the agent's active social connections (FB Pages today).
 * Access tokens are intentionally NOT projected — only metadata.
 */
export async function GET() {
  try {
    const { agentId } = await getCurrentAgentContext();
    const connections = await listConnectionsForAgent(String(agentId));
    return NextResponse.json({ ok: true, connections });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
