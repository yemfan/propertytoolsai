import { NextResponse } from "next/server";
import { findLeadByPhone, getRecentSmsMessages, normalizeTwilioFromToUsPhone } from "@/lib/ai-sms/lead-resolution";
import { inferIntentHeuristic } from "@/lib/ai-sms/intent";
import { generateSmsAssistantReply } from "@/lib/ai-sms/service";

export const runtime = "nodejs";

function authorized(req: Request) {
  const secret = process.env.AI_SMS_TEST_SECRET?.trim();
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
      fromPhone?: string;
      toPhone?: string;
      body?: string;
    };
    const fromRaw = String(body.fromPhone ?? "").trim();
    const toPhone = String(body.toPhone ?? "").trim();
    const text = String(body.body ?? "").trim();
    if (!fromRaw || !toPhone || !text) {
      return NextResponse.json({ success: false, error: "Missing fields" }, { status: 400 });
    }

    const display = normalizeTwilioFromToUsPhone(fromRaw) || fromRaw;
    const leadSnap = await findLeadByPhone(display);
    const recentMessages = leadSnap?.leadId ? await getRecentSmsMessages(leadSnap.leadId, 8) : [];
    const inferredIntent = inferIntentHeuristic(text);

    const reply = await generateSmsAssistantReply({
      fromPhone: fromRaw,
      toPhone,
      inboundBody: text,
      lead: leadSnap,
      recentMessages,
      inferredIntent,
    });

    return NextResponse.json({ success: true, reply });
  } catch (e: unknown) {
    console.error("ai-sms reply:", e);
    return NextResponse.json({ success: false, error: "Failed to generate reply" }, { status: 500 });
  }
}
