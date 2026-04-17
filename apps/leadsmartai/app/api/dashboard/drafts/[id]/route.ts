import { NextResponse } from "next/server";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import {
  approveDraft,
  editDraft,
  getDraft,
  rejectDraft,
} from "@/lib/drafts/service";
import { dispatchApprovedDrafts } from "@/lib/drafts/sender";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const { agentId } = await getCurrentAgentContext();
    const draft = await getDraft(agentId, id);
    if (!draft) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, draft });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const { agentId } = await getCurrentAgentContext();
    const body = (await req.json()) as {
      action?: string;
      subject?: string | null;
      body?: string;
      reason?: string | null;
    };

    if (body.action === "approve") {
      await approveDraft(agentId, id);
      const draft = await getDraft(agentId, id);
      return NextResponse.json({ ok: true, draft });
    }
    if (body.action === "reject") {
      await rejectDraft(agentId, id, body.reason ?? null);
      const draft = await getDraft(agentId, id);
      return NextResponse.json({ ok: true, draft });
    }
    if (body.action === "edit") {
      const patch: { subject?: string | null; body?: string } = {};
      if ("subject" in body) patch.subject = body.subject ?? null;
      if (typeof body.body === "string") patch.body = body.body;
      const draft = await editDraft(agentId, id, patch);
      return NextResponse.json({ ok: true, draft });
    }
    if (body.action === "dispatch") {
      // Manual "send now" — dispatch this single approved draft immediately,
      // still runs the guardrails. Useful for testing + urgent sends.
      const result = await dispatchApprovedDrafts({ agentId, draftId: id, limit: 1 });
      const draft = await getDraft(agentId, id);
      return NextResponse.json({ ok: true, draft, result });
    }

    return NextResponse.json(
      { ok: false, error: "action must be approve | reject | edit | dispatch" },
      { status: 400 },
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    const status = /does not belong|not found|cannot/i.test(msg) ? 403 : 500;
    console.error("drafts/[id] PATCH", e);
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
