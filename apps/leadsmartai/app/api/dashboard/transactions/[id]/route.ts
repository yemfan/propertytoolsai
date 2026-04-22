import { NextResponse } from "next/server";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import {
  getTransactionWithChildren,
  updateTransaction,
  type UpdateTransactionInput,
} from "@/lib/transactions/service";

export const runtime = "nodejs";

/**
 * GET /api/dashboard/transactions/[id]
 * Returns the transaction + its tasks + counterparties + the
 * denormalized contact name. Detail-page data in one round trip.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { agentId } = await getCurrentAgentContext();
    const { id } = await ctx.params;
    if (!id) return NextResponse.json({ ok: false, error: "id is required" }, { status: 400 });
    const bundle = await getTransactionWithChildren(String(agentId), id);
    if (!bundle) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true, ...bundle });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error(`GET /api/dashboard/transactions/[id]:`, err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

/**
 * PATCH /api/dashboard/transactions/[id]
 * Partial update. When `mutual_acceptance_date` transitions to a
 * non-null value, NULL deadline columns get CA defaults filled in
 * (service handles it — safe to just pass the field through).
 */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { agentId } = await getCurrentAgentContext();
    const { id } = await ctx.params;
    const input = (await req.json().catch(() => ({}))) as UpdateTransactionInput;
    const updated = await updateTransaction(String(agentId), id, input);
    if (!updated) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true, transaction: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error(`PATCH /api/dashboard/transactions/[id]:`, err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
