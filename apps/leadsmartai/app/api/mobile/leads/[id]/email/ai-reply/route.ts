import { NextResponse } from "next/server";
import { subscriptionRequiredResponse } from "@/lib/billing/subscriptionAccess";
import { peekAiUsageAllowed, tryConsumeAiCredit } from "@/lib/funnel/aiUsage";
import { requireMobileAgent } from "@/lib/mobile/auth";
import { mobileDraftEmailAiReply } from "@/lib/mobile/replyComposerService";

export const runtime = "nodejs";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireMobileAgent(req);
  if (auth.ok === false) return auth.response;

  try {
    const { id } = await ctx.params;
    const leadId = String(id ?? "").trim();
    if (!leadId) {
      return NextResponse.json({ ok: false, success: false, error: "Missing lead id" }, { status: 400 });
    }

    if (!(await peekAiUsageAllowed(auth.ctx.userId))) {
      return subscriptionRequiredResponse("limited_ai", "ai_usage_limit_reached");
    }

    const draft = await mobileDraftEmailAiReply(auth.ctx.agentId, leadId);

    const credit = await tryConsumeAiCredit(auth.ctx.userId, {
      usageMetadata: { surface: "mobile_email_ai_reply" },
    });
    if (!credit.allowed) {
      return subscriptionRequiredResponse("limited_ai", "ai_usage_limit_reached");
    }

    return NextResponse.json({
      ok: true,
      success: true,
      subject: draft.subject,
      body: draft.body,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    if (msg === "NOT_FOUND") {
      return NextResponse.json({ ok: false, success: false, error: "Lead not found" }, { status: 404 });
    }
    console.error("POST /api/mobile/leads/[id]/email/ai-reply", e);
    return NextResponse.json({ ok: false, success: false, error: msg }, { status: 500 });
  }
}
