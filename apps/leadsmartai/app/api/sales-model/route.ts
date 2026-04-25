import { NextResponse } from "next/server";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import {
  getSelectedSalesModelServer,
  saveSelectedSalesModelServer,
} from "@/lib/sales-model-server";
import { isSalesModelId } from "@/lib/sales-models";

export const runtime = "nodejs";

/**
 * Sales Model selection — read + write.
 *
 * GET   → { ok, salesModel: SalesModelId | null }
 * PUT   → { ok }                — body: { salesModel: SalesModelId }
 *
 * Auth: uses `getCurrentAgentContext()` for parity with the rest of
 * the dashboard. Anonymous callers get 401; the client storage helper
 * falls back to localStorage in that case so dev / signed-out demo
 * flows still work.
 */

export async function GET() {
  let userId: string;
  try {
    const ctx = await getCurrentAgentContext();
    userId = ctx.userId;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unauthorized";
    return NextResponse.json(
      { ok: false, error: msg },
      { status: msg === "Not authenticated" ? 401 : 500 },
    );
  }
  const salesModel = await getSelectedSalesModelServer(userId);
  return NextResponse.json({ ok: true, salesModel });
}

export async function PUT(req: Request) {
  let userId: string;
  try {
    const ctx = await getCurrentAgentContext();
    userId = ctx.userId;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unauthorized";
    return NextResponse.json(
      { ok: false, error: msg },
      { status: msg === "Not authenticated" ? 401 : 500 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as { salesModel?: unknown };
  const candidate = body.salesModel;
  if (!isSalesModelId(candidate)) {
    return NextResponse.json(
      {
        ok: false,
        error: "salesModel must be one of: influencer, closer, advisor, custom.",
      },
      { status: 400 },
    );
  }

  const result = await saveSelectedSalesModelServer(userId, candidate);
  if (result.ok === false) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }
  return NextResponse.json({ ok: true, salesModel: candidate });
}
