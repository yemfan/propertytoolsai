import { NextResponse } from "next/server";

import { getDashboardAgentContext } from "@/lib/contact-intake/dashboardAgentContext";
import { deleteMedia } from "@/lib/leads-gen/media";

export const runtime = "nodejs";

/**
 * DELETE /api/leads-gen/media/[id]
 *
 * Removes a media item from both the metadata table and storage.
 * Idempotent — deleting a missing id returns 200 too, so a retried
 * delete after a network blip doesn't surface as a confusing 404.
 *
 * Ownership enforced by `deleteMedia` (filters on agent_id before
 * any storage operation).
 */
export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await getDashboardAgentContext();
    if (auth.ok === false) return auth.response;

    if (auth.planType === "free") {
      return NextResponse.json(
        { ok: false, error: "Media library requires Pro or higher." },
        { status: 402 },
      );
    }

    const { id } = await ctx.params;
    if (!id) {
      return NextResponse.json(
        { ok: false, error: "Missing media id" },
        { status: 400 },
      );
    }

    await deleteMedia(auth.agentId, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Delete failed";
    console.error("[leads-gen/media/delete]", e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
