import { NextResponse } from "next/server";
import { requireMobileAgent } from "@/lib/mobile/auth";
import {
  getTransactionWithChildren,
  updateTransaction,
  type UpdateTransactionInput,
} from "@/lib/transactions/service";

export const runtime = "nodejs";

/**
 * GET /api/mobile/transactions/[id]
 *   Returns { transaction, tasks, counterparties, contactName }.
 *
 * PATCH /api/mobile/transactions/[id]
 *   Partial update. The service layer auto-runs deadline defaults
 *   when mutual_acceptance_date transitions, applies the on-close
 *   backfill on active → closed, and recomputes commission on close
 *   or price change.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireMobileAgent(req);
  if (auth.ok === false) return auth.response;

  try {
    const { id } = await ctx.params;
    const bundle = await getTransactionWithChildren(auth.ctx.agentId, id);
    if (!bundle) {
      return NextResponse.json(
        { ok: false, success: false, error: "Not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true, success: true, ...bundle });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("GET /api/mobile/transactions/[id]", e);
    return NextResponse.json(
      { ok: false, success: false, error: msg },
      { status: 500 },
    );
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireMobileAgent(req);
  if (auth.ok === false) return auth.response;

  try {
    const { id } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as UpdateTransactionInput;
    const updated = await updateTransaction(auth.ctx.agentId, id, body);
    if (!updated) {
      return NextResponse.json(
        { ok: false, success: false, error: "Not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true, success: true, transaction: updated });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("PATCH /api/mobile/transactions/[id]", e);
    return NextResponse.json(
      { ok: false, success: false, error: msg },
      { status: 500 },
    );
  }
}
