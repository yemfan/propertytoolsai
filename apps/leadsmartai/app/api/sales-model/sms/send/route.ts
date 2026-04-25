import { NextResponse } from "next/server";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import { sendSmsForAgent } from "@/lib/sales-model-sms";

export const runtime = "nodejs";

/**
 * POST /api/sales-model/sms/send
 *
 * Body: { contactId, message }
 *
 * Sends an outbound SMS via Twilio + writes the `message_logs` row
 * the conversation poll reads from. Validates contact ownership, the
 * existence of a phone number, and rejects empty / oversized bodies.
 *
 * Distinct error codes (twilio_unconfigured, no_phone, contact_not_found)
 * so the client can show specific banners instead of a generic 500.
 */
export async function POST(req: Request) {
  let agentId: string;
  try {
    const ctx = await getCurrentAgentContext();
    agentId = ctx.agentId;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unauthorized";
    return NextResponse.json(
      { ok: false, error: msg },
      { status: msg === "Not authenticated" ? 401 : 500 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    contactId?: unknown;
    message?: unknown;
  };
  const contactId =
    typeof body.contactId === "string" ? body.contactId.trim() : "";
  const message = typeof body.message === "string" ? body.message : "";

  if (!contactId) {
    return NextResponse.json(
      { ok: false, error: "contactId is required.", code: "missing_contact_id" },
      { status: 400 },
    );
  }

  const result = await sendSmsForAgent({ agentId, contactId, message });
  if (result.ok === false) {
    return NextResponse.json(
      { ok: false, error: result.error, code: result.code },
      { status: result.status ?? 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    sid: result.sid,
    messageLogId: result.messageLogId,
  });
}
