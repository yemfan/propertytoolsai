import { NextResponse } from "next/server";
import { markFirstReply } from "@/lib/funnel/funnelAnalytics";
import { requireMobileAgent } from "@/lib/mobile/auth";
import { mobileSendEmailReply } from "@/lib/mobile/replyComposerService";

export const runtime = "nodejs";

type Body = { subject?: string; body?: string; message?: string };

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
    const subject = String(json.subject ?? "").trim();
    const body = String(json.body ?? json.message ?? "").trim();
    if (!subject) {
      return NextResponse.json({ ok: false, success: false, error: "subject is required" }, { status: 400 });
    }
    if (!body) {
      return NextResponse.json({ ok: false, success: false, error: "body is required" }, { status: 400 });
    }

    const message = await mobileSendEmailReply({
      agentId: auth.ctx.agentId,
      leadId,
      subject,
      body,
    });

    void markFirstReply(auth.ctx.userId, "email");

    return NextResponse.json({ ok: true, success: true, message });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    if (msg === "NOT_FOUND") {
      return NextResponse.json({ ok: false, success: false, error: "Lead not found" }, { status: 404 });
    }
    const status = msg.includes("no email") ? 400 : 500;
    console.error("POST /api/mobile/leads/[id]/email/send", e);
    return NextResponse.json({ ok: false, success: false, error: msg }, { status });
  }
}
