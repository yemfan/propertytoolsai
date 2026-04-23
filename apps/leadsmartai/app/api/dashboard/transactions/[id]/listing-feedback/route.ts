import { NextResponse } from "next/server";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import {
  createListingFeedback,
  listFeedbackForTransaction,
  type CreateListingFeedbackInput,
} from "@/lib/listing-feedback/service";

export const runtime = "nodejs";

/**
 * GET  /api/dashboard/transactions/[id]/listing-feedback
 *   All feedback rows for this listing (responses + pending requests).
 *
 * POST /api/dashboard/transactions/[id]/listing-feedback
 *   Create a feedback request for a buyer-side showing. Body mirrors
 *   CreateListingFeedbackInput sans agentId/transactionId.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { agentId } = await getCurrentAgentContext();
    const { id } = await ctx.params;
    const rows = await listFeedbackForTransaction(String(agentId), id);
    return NextResponse.json({ ok: true, feedback: rows });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error("GET listing-feedback:", err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { agentId } = await getCurrentAgentContext();
    const { id } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as Partial<CreateListingFeedbackInput>;

    const created = await createListingFeedback({
      agentId: String(agentId),
      transactionId: id,
      buyerAgentName: body.buyerAgentName ?? null,
      buyerAgentEmail: body.buyerAgentEmail ?? null,
      buyerAgentPhone: body.buyerAgentPhone ?? null,
      buyerAgentBrokerage: body.buyerAgentBrokerage ?? null,
      buyerName: body.buyerName ?? null,
      showingDate: body.showingDate ?? null,
    });

    return NextResponse.json({ ok: true, feedback: created });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    const status = /Listing transaction not found/i.test(message) ? 404 : 500;
    console.error("POST listing-feedback:", err);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
