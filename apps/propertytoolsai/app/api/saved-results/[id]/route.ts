import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/authFromRequest";
import { deleteSavedResult } from "@/lib/savedResults/service";

export const runtime = "nodejs";

/**
 * DELETE /api/saved-results/[id]
 *   Removes one saved result. Scoped by user_id so users can only
 *   delete their own rows.
 */
export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Not signed in" },
        { status: 401 },
      );
    }
    const { id } = await ctx.params;
    const ok = await deleteSavedResult(user.id, id);
    if (!ok) {
      return NextResponse.json(
        { ok: false, error: "Not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error("DELETE /api/saved-results/[id]:", err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
