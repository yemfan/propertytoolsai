import { NextResponse } from "next/server";
import { getCurrentAgentContext, isNumericCrmAgentId } from "@/lib/dashboardService";
import { insertBusinessEvent, insertRevenueTransaction } from "@/lib/revenueKpi/db";

export const runtime = "nodejs";

type Body = {
  eventName?: string;
  sessionId?: string | null;
  properties?: Record<string, unknown>;
  /** Optional micro-revenue on event (e.g. upgrade) */
  revenueCents?: number | null;
  /** If set, also records a revenue_transactions row */
  recordTransaction?: {
    amountCents: number;
    currency?: string;
    category?: string;
    source?: string;
    externalRef?: string | null;
  };
};

/**
 * Track funnel / product events for the authenticated agent.
 * For server-to-server, call with session cookie or Bearer token.
 */
export async function POST(req: Request) {
  try {
    const ctx = await getCurrentAgentContext();
    if (!isNumericCrmAgentId(ctx.agentId)) {
      return NextResponse.json(
        { ok: false, error: "Agent profile required for revenue tracking.", needsAgentProfile: true },
        { status: 403 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as Body;

    const eventName = String(body.eventName ?? "").trim();
    if (!eventName) {
      return NextResponse.json({ ok: false, error: "eventName is required" }, { status: 400 });
    }

    await insertBusinessEvent({
      agentId: ctx.agentId,
      eventName,
      sessionId: body.sessionId ?? null,
      properties: body.properties ?? {},
      revenueCents: body.revenueCents ?? null,
    });

    if (body.recordTransaction && body.recordTransaction.amountCents != null) {
      await insertRevenueTransaction({
        agentId: ctx.agentId,
        amountCents: Math.round(Number(body.recordTransaction.amountCents)),
        currency: body.recordTransaction.currency,
        category: body.recordTransaction.category,
        source: body.recordTransaction.source ?? "api",
        externalRef: body.recordTransaction.externalRef ?? null,
        metadata: { eventName },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e?.message === "Not authenticated") {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    console.error("POST /api/revenue/track", e);
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}
