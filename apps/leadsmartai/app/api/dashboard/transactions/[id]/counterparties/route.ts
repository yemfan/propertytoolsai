import { NextResponse } from "next/server";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import { addCounterparty } from "@/lib/transactions/service";
import type { CounterpartyRole } from "@/lib/transactions/types";

export const runtime = "nodejs";

const VALID_ROLES: readonly CounterpartyRole[] = [
  "title",
  "lender",
  "inspector",
  "insurance",
  "co_agent",
  "other",
];

/**
 * POST /api/dashboard/transactions/[id]/counterparties
 * Add a counterparty contact (title officer, lender, inspector, etc.)
 * to the transaction.
 *
 * Body: { role, name, company?, email?, phone?, notes? }
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { agentId } = await getCurrentAgentContext();
    const { id } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as {
      role?: string;
      name?: string;
      company?: string | null;
      email?: string | null;
      phone?: string | null;
      notes?: string | null;
    };
    if (!body.role || !VALID_ROLES.includes(body.role as CounterpartyRole)) {
      return NextResponse.json(
        { ok: false, error: `role must be one of ${VALID_ROLES.join(", ")}` },
        { status: 400 },
      );
    }
    if (!body.name || typeof body.name !== "string") {
      return NextResponse.json({ ok: false, error: "name is required" }, { status: 400 });
    }
    const cp = await addCounterparty(String(agentId), id, {
      role: body.role as CounterpartyRole,
      name: body.name,
      company: body.company ?? null,
      email: body.email ?? null,
      phone: body.phone ?? null,
      notes: body.notes ?? null,
    });
    return NextResponse.json({ ok: true, counterparty: cp });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error(`POST counterparty:`, err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
