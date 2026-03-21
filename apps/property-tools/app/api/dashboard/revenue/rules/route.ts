import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/adminRole";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";

export async function PATCH(req: Request) {
  try {
    const ctx = await getCurrentAgentContext();
    const forbidden = await requireAdminApi(ctx.userId);
    if (forbidden) return forbidden;

    const body = (await req.json()) as {
      ruleId: string;
      enabled?: boolean;
      threshold_numeric?: number;
    };

    const ruleId = String(body.ruleId ?? "").trim();
    if (!ruleId) {
      return NextResponse.json({ ok: false, error: "ruleId required" }, { status: 400 });
    }

    const patch: Record<string, unknown> = {};
    if (typeof body.enabled === "boolean") patch.enabled = body.enabled;
    if (body.threshold_numeric !== undefined) {
      const n = Number(body.threshold_numeric);
      if (!Number.isFinite(n)) {
        return NextResponse.json({ ok: false, error: "threshold_numeric invalid" }, { status: 400 });
      }
      patch.threshold_numeric = n;
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ ok: false, error: "No updates" }, { status: 400 });
    }

    const { error } = await supabaseServer
      .from("kpi_alert_rules")
      .update(patch)
      .eq("id", ruleId)
      .eq("agent_id", ctx.agentId);

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e?.message === "Not authenticated") {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    console.error("PATCH /api/dashboard/revenue/rules", e);
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}
