import { NextResponse } from "next/server";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import {
  getListingById,
  updateListing,
  type UpdateListingInput,
} from "@/lib/listings/service";

export const runtime = "nodejs";

/**
 * GET /api/dashboard/listings/[id]
 * Returns the full listing detail (same shape used by the
 * /dashboard/listings/[id] server component).
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { agentId } = await getCurrentAgentContext();
    const { id } = await ctx.params;
    const listing = await getListingById(String(agentId), id);
    if (!listing) {
      return NextResponse.json({ ok: false, error: "Listing not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, listing });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error("GET /api/dashboard/listings/[id]:", err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

/**
 * PATCH /api/dashboard/listings/[id]
 * Generic listing field updates (status, list_price, dates, etc.)
 * Body shape mirrors UpdateListingInput.
 *
 * Common use: flipping status to 'contracted' when an offer is
 * accepted, before routing to the new-transaction form.
 */
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { agentId } = await getCurrentAgentContext();
    const { id } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as UpdateListingInput;
    const updated = await updateListing(String(agentId), id, body);
    if (!updated) {
      return NextResponse.json({ ok: false, error: "Listing not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, listing: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error("PATCH /api/dashboard/listings/[id]:", err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
