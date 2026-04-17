import { NextResponse } from "next/server";
import { getCurrentAgentContext } from "@/lib/dashboardService";

export const runtime = "nodejs";

/**
 * Minimal helper so the seed scripts (and anything local) can fetch the
 * signed-in user's agentId without querying the DB directly. Restricted to
 * authenticated sessions only — getCurrentAgentContext throws if not.
 */
export async function GET() {
  try {
    const ctx = await getCurrentAgentContext();
    return NextResponse.json({
      ok: true,
      agentId: ctx.agentId,
      userId: ctx.userId,
      email: ctx.email,
      planType: ctx.planType,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Not authenticated";
    return NextResponse.json({ ok: false, error: msg }, { status: 401 });
  }
}
