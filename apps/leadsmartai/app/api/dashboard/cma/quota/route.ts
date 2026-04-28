import { NextResponse } from "next/server";

import { getCmaQuotaForUser } from "@/lib/cma/quota";
import { getCurrentAgentContext } from "@/lib/dashboardService";

export const runtime = "nodejs";

/**
 * GET /api/dashboard/cma/quota
 *
 * Read-only peek at the agent's daily CMA quota — used by the
 * new-CMA form to surface "X of Y left today" before submit. The
 * upstream `/api/smart-cma` already enforces the same limit at
 * generation time; this endpoint just lets the UI show it without
 * eating a quota slot.
 */
export async function GET() {
  try {
    const { userId } = await getCurrentAgentContext();
    const quota = await getCmaQuotaForUser(userId);
    return NextResponse.json({ ok: true, quota });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
