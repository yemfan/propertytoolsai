import { NextResponse } from "next/server";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import { convertOfferToTransaction } from "@/lib/offers/service";

export const runtime = "nodejs";

/**
 * POST /api/dashboard/offers/[id]/convert
 *
 * Creates a buyer-rep transaction from an accepted offer and back-links
 * both rows. Body is optional; `{ mutualAcceptanceDate: "YYYY-MM-DD" }`
 * overrides the default (offer.accepted_at).
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { agentId } = await getCurrentAgentContext();
    const { id } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as {
      mutualAcceptanceDate?: string | null;
    };
    const transaction = await convertOfferToTransaction(String(agentId), id, {
      mutualAcceptanceDate: body.mutualAcceptanceDate ?? null,
    });
    return NextResponse.json({ ok: true, transaction });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error("POST offers/[id]/convert:", err);
    const status =
      message === "Offer not found"
        ? 404
        : /accepted|already been converted/i.test(message)
          ? 400
          : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
