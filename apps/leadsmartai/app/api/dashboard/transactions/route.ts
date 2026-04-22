import { NextResponse } from "next/server";
import { getCurrentAgentContext } from "@/lib/dashboardService";
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
    const body = (await req.json().catch(() => ({}))) as Partial<CreateTransactionInput>;

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
      mutualAcceptanceDate: body.mutualAcceptanceDate ?? null,
      closingDate: body.closingDate ?? null,
      notes: body.notes ?? null,
    });

    return NextResponse.json({ ok: true, transaction: created });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error("POST /api/dashboard/transactions:", err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
