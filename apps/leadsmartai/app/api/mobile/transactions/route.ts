import { NextResponse } from "next/server";
import { requireMobileAgent } from "@/lib/mobile/auth";
import { listTransactionsForAgent } from "@/lib/transactions/service";

export const runtime = "nodejs";

/**
 * GET /api/mobile/transactions
 *
 * Returns the same denormalized list view as the dashboard — each
 * transaction plus task_total / task_completed / task_overdue
 * counters so the list view can show progress bars without a per-row
 * fetch. Mobile clients may filter client-side by status; this
 * endpoint always returns the full set so the cached payload covers
 * every chip.
 */
export async function GET(req: Request) {
  const auth = await requireMobileAgent(req);
  if (auth.ok === false) return auth.response;

  try {
    const items = await listTransactionsForAgent(auth.ctx.agentId);
    return NextResponse.json({ ok: true, success: true, transactions: items });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("GET /api/mobile/transactions", e);
    return NextResponse.json(
      { ok: false, success: false, error: msg },
      { status: 500 },
    );
  }
}
