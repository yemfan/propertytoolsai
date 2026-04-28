import { NextResponse } from "next/server";

import { getCurrentAgentContext } from "@/lib/dashboardService";
import { revokeConnection } from "@/lib/social/connectionsService";

export const runtime = "nodejs";

/**
 * DELETE /api/dashboard/social/connections/[id]
 *
 * Soft-revokes the connection (sets `revoked_at`). Doesn't hard-delete
 * because the social_post_log audit table FKs back to it; preserving
 * the row keeps "this post went out via account X" resolvable forever.
 */
export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { agentId } = await getCurrentAgentContext();
    const { id } = await ctx.params;
    const ok = await revokeConnection({ agentId: String(agentId), connectionId: id });
    if (!ok) {
      return NextResponse.json(
        { ok: false, error: "Failed to revoke." },
        { status: 500 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
