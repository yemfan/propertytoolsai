import { NextResponse } from "next/server";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import { deleteCounterparty, updateCounterparty } from "@/lib/transactions/service";

export const runtime = "nodejs";

/**
 * PATCH /api/dashboard/transactions/[id]/counterparties/[cpId]
 * Body: any subset of { role, name, company, email, phone, notes }
 */
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string; cpId: string }> },
) {
  try {
    const { agentId } = await getCurrentAgentContext();
    const { cpId } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as Parameters<typeof updateCounterparty>[2];
    const cp = await updateCounterparty(String(agentId), cpId, body);
    if (!cp) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true, counterparty: cp });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error(`PATCH counterparty:`, err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/dashboard/transactions/[id]/counterparties/[cpId]
 */
export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string; cpId: string }> },
) {
  try {
    const { agentId } = await getCurrentAgentContext();
    const { cpId } = await ctx.params;
    const ok = await deleteCounterparty(String(agentId), cpId);
    if (!ok) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error(`DELETE counterparty:`, err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
