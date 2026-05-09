import { NextResponse } from "next/server";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  createTransaction,
  listTransactionsForAgent,
  type CreateTransactionInput,
} from "@/lib/transactions/service";

export const runtime = "nodejs";

/**
 * GET /api/dashboard/transactions
 * List all transactions for the signed-in agent, with task-completion
 * counters for the list view.
 */
export async function GET() {
  try {
    const { agentId } = await getCurrentAgentContext();
    const items = await listTransactionsForAgent(String(agentId));
    return NextResponse.json({ ok: true, transactions: items });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error("GET /api/dashboard/transactions:", err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

/**
 * POST /api/dashboard/transactions
 * Create a new transaction. Seeds the buyer-rep checklist from
 * lib/transactions/seedTasks.ts in the same request so the agent
 * lands on a useful detail page immediately.
 *
 * Body: { contactId, propertyAddress, transactionType?, city?, state?,
 *         zip?, purchasePrice?, mutualAcceptanceDate?, closingDate?,
 *         notes? }
 */
export async function POST(req: Request) {
  try {
    const { agentId } = await getCurrentAgentContext();
    const body = (await req.json().catch(() => ({}))) as Partial<
      CreateTransactionInput & { offerId?: string | null }
    >;

    if (!body.contactId || !body.propertyAddress) {
      return NextResponse.json(
        { ok: false, error: "contactId and propertyAddress are required." },
        { status: 400 },
      );
    }

    const created = await createTransaction({
      agentId: String(agentId),
      contactId: String(body.contactId),
      propertyAddress: String(body.propertyAddress),
      transactionType: body.transactionType,
      city: body.city ?? null,
      state: body.state ?? null,
      zip: body.zip ?? null,
      purchasePrice: body.purchasePrice ?? null,
      listingStartDate: body.listingStartDate ?? null,
      mutualAcceptanceDate: body.mutualAcceptanceDate ?? null,
      closingDate: body.closingDate ?? null,
      notes: body.notes ?? null,
    });

    // Back-link offer → transaction when this form was opened from
    // the ✓ Accept flow (`?offerId` in the URL). Best-effort: a
    // failed back-link doesn't fail the transaction creation since
    // the transaction is the user's primary intent. The agent can
    // re-link manually via the offer detail page if it doesn't take.
    if (body.offerId) {
      try {
        await supabaseAdmin
          .from("offers")
          .update({
            transaction_id: created.id,
            updated_at: new Date().toISOString(),
          })
          .eq("id", body.offerId)
          .eq("agent_id", agentId);
      } catch (e) {
        console.warn(
          "[POST /transactions] back-link offer→transaction failed:",
          e instanceof Error ? e.message : e,
        );
      }
    }

    return NextResponse.json({ ok: true, transaction: created });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error("POST /api/dashboard/transactions:", err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
