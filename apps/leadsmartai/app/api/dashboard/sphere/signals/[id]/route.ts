import { NextResponse } from "next/server";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import {
  acknowledgeSignal,
  dismissSignal,
  restoreSignal,
} from "@/lib/contacts/service";

export const runtime = "nodejs";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const { agentId } = await getCurrentAgentContext();
    const body = (await req.json().catch(() => ({}))) as { action?: string };

    if (body.action === "acknowledge") {
      await acknowledgeSignal(agentId, id);
    } else if (body.action === "restore") {
      await restoreSignal(agentId, id);
    } else if (body.action === "dismiss") {
      await dismissSignal(agentId, id);
    } else {
      return NextResponse.json(
        { ok: false, error: "action must be acknowledge | restore | dismiss" },
        { status: 400 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    const status = /does not belong|not found/i.test(msg) ? 403 : 500;
    console.error("sphere/signals/[id] PATCH", e);
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const { agentId } = await getCurrentAgentContext();
    await dismissSignal(agentId, id);
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    const status = /does not belong|not found/i.test(msg) ? 403 : 500;
    console.error("sphere/signals/[id] DELETE", e);
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
