import { NextResponse } from "next/server";
import { markFirstReply } from "@/lib/funnel/funnelAnalytics";
import { requireMobileAgent } from "@/lib/mobile/auth";
import { mobileSendSmsReply } from "@/lib/mobile/replyComposerService";

export const runtime = "nodejs";

type Body = { body?: string; message?: string };

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireMobileAgent(req);
  if (auth.ok === false) return auth.response;

  try {
    const { id } = await ctx.params;
    const leadId = String(id ?? "").trim();
    if (!leadId) {
      return NextResponse.json({ ok: false, success: false, error: "Missing lead id" }, { status: 400 });
    }

    const json = (await req.json().catch(() => ({}))) as Body;
    const text = String(json.body ?? json.message ?? "").trim();
    if (!text) {
      return NextResponse.json({ ok: false, success: false, error: "body is required" }, { status: 400 });
    }

    const message = await mobileSendSmsReply({
      agentId: auth.ctx.agentId,
      leadId,
      body: text,
    });

    void markFirstReply(auth.ctx.userId, "sms");

    return NextResponse.json({ ok: true, success: true, message });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    if (msg === "NOT_FOUND") {
      return NextResponse.json({ ok: false, success: false, error: "Lead not found" }, { status: 404 });
    }
    const status = msg.includes("no phone") || msg.includes("too long") ? 400 : 500;
    console.error("POST /api/mobile/leads/[id]/sms/send", e);
    return NextResponse.json({ ok: false, success: false, error: msg }, { status });
  }
}
