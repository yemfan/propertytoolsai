import { NextResponse } from "next/server";

import {
  computeDismissedUntil,
} from "@/lib/coaching/dismissals";
import { upsertCoachingDismissal } from "@/lib/coaching/service";
import { getCurrentAgentContext } from "@/lib/dashboardService";

export const runtime = "nodejs";

/**
 * POST /api/dashboard/coaching/dismiss
 *
 * Body: { insightId: string, days?: number }
 *
 * Upserts a TTL dismissal for the given insight. Defaults to 7 days
 * (clamped to 1–30 by the pure helper). The next coaching dashboard
 * load filters this insight out until the timestamp passes.
 */
export async function POST(req: Request) {
  try {
    const { agentId } = await getCurrentAgentContext();
    const body = (await req.json().catch(() => ({}))) as {
      insightId?: unknown;
      days?: unknown;
    };
    const insightId =
      typeof body.insightId === "string" ? body.insightId.trim() : "";
    if (!insightId) {
      return NextResponse.json(
        { ok: false, error: "insightId is required." },
        { status: 400 },
      );
    }

    const days =
      typeof body.days === "number" && Number.isFinite(body.days)
        ? body.days
        : undefined;

    const dismissedUntilIso = computeDismissedUntil({
      nowIso: new Date().toISOString(),
      days,
    });

    await upsertCoachingDismissal({
      agentId: String(agentId),
      insightId,
      dismissedUntilIso,
    });

    return NextResponse.json({ ok: true, dismissedUntil: dismissedUntilIso });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
