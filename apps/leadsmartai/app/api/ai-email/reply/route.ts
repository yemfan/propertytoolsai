import { NextResponse } from "next/server";
import { findLeadByEmail, getRecentEmailMessages } from "@/lib/ai-email/lead-resolution";
import { inferEmailIntentHeuristic } from "@/lib/ai-email/intent";
import { generateEmailAssistantReply } from "@/lib/ai-email/service";

export const runtime = "nodejs";

function authorized(req: Request) {
  const secret = process.env.AI_EMAIL_TEST_SECRET?.trim();
  if (!secret) return process.env.NODE_ENV !== "production";
  const h = req.headers.get("authorization") || "";
  return h === `Bearer ${secret}`;
}

export async function POST(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as {
      fromEmail?: string;
      toEmail?: string;
      subject?: string;
      body?: string;
    };
    const fromEmail = String(body.fromEmail ?? "").trim();
    const toEmail = String(body.toEmail ?? "").trim();
    const subject = String(body.subject ?? "").trim();
    const text = String(body.body ?? "").trim();
    if (!fromEmail || !toEmail || !subject || !text) {
      return NextResponse.json({ success: false, error: "Missing fields" }, { status: 400 });
    }

    const lead = await findLeadByEmail(fromEmail);
    const recentMessages = lead?.leadId ? await getRecentEmailMessages(lead.leadId, 8) : [];
    const inferredIntent = inferEmailIntentHeuristic(subject, text);

    const reply = await generateEmailAssistantReply({
      fromEmail,
      toEmail,
      subject,
      inboundBody: text,
      lead,
      recentMessages,
      inferredIntent,
    });

    return NextResponse.json({ success: true, reply });
  } catch (e) {
    console.error("ai-email reply:", e);
    return NextResponse.json({ success: false, error: "Failed to generate reply" }, { status: 500 });
  }
}
