import { NextResponse } from "next/server";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import { startClickToCall } from "@/lib/power-dialer/service";

export const runtime = "nodejs";

/**
 * POST /api/dashboard/click-to-call
 *
 * Body: { contactId: string, record?: boolean }
 *
 * Kicks off the agent-first click-to-call flow. Returns the
 * call_logs.id + Twilio CallSid so the client can poll the events
 * endpoint for status updates.
 *
 * Distinct error codes (no_forwarding_phone, no_contact_phone,
 * twilio_unconfigured) so the UI can show specific banners — for
 * example, "Add your mobile in Settings" instead of a generic 500.
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
    record?: unknown;
  };
  const contactId =
    typeof body.contactId === "string" ? body.contactId.trim() : "";
  if (!contactId) {
    return NextResponse.json(
      { ok: false, error: "contactId is required.", code: "missing_contact_id" },
      { status: 400 },
    );
  }
  const record = body.record === true;

  const result = await startClickToCall({ agentId, contactId, record });
  if (result.ok === false) {
    return NextResponse.json(
      { ok: false, error: result.error, code: result.code },
      { status: result.status ?? 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    callLogId: result.callLogId,
    twilioCallSid: result.twilioCallSid,
    message: result.message,
  });
}
