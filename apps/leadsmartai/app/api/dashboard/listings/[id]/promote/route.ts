import { NextResponse } from "next/server";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import { promoteListingToTransaction } from "@/lib/listings/service";

export const runtime = "nodejs";

/**
 * POST /api/dashboard/listings/[id]/promote
 *
 * Phase 2d of the listings/transactions split. Spawns a buyer-rep
 * transaction (or dual) from a listing and back-links the two rows.
 * Triggered when the agent marks an offer as accepted on the
 * listing — the listing goes from "active"/"pending" to
 * "contracted" and the new transaction starts the post-acceptance
 * lifecycle (escrow, contingencies, closing).
 *
 * Body (all optional):
 *   {
 *     mutualAcceptanceDate?: "YYYY-MM-DD",  // defaults to today
 *     closingDate?:          "YYYY-MM-DD",
 *     purchasePrice?:        number,        // overrides list_price
 *     transactionType?:      "listing_rep" | "dual"
 *   }
 *
 * Idempotent: a listing that's already been promoted (has
 * transaction_id set) returns the existing transaction id without
 * spawning a duplicate.
 *
 * Returns: { ok, listingId, transactionId }
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { agentId } = await getCurrentAgentContext();
    const { id } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as {
      mutualAcceptanceDate?: string | null;
      closingDate?: string | null;
      purchasePrice?: number | null;
      transactionType?: "listing_rep" | "dual";
    };

    const result = await promoteListingToTransaction(
      String(agentId),
      id,
      body,
    );

    return NextResponse.json({
      ok: true,
      listingId: result.listingId,
      transactionId: result.transactionId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error("POST /api/dashboard/listings/[id]/promote:", err);
    const status =
      message.includes("not found")
        ? 404
        : message.includes("withdrawn") || message.includes("expired")
          ? 400
          : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
