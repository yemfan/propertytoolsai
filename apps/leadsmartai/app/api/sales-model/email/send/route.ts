import { NextResponse } from "next/server";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import { sendEmailForAgent } from "@/lib/sales-model-email";

export const runtime = "nodejs";

/**
 * POST /api/sales-model/email/send
 *
 * Body: { contactId, subject, body }
 *
 * Sends an outbound email via Resend (when configured) + writes the
 * `email_messages` and `message_logs` rows so the dashboard's
 * conversation views see the sent email immediately.
 *
 * Distinct error codes (resend_unconfigured, no_email,
 * contact_not_found) so the client can show specific banners.
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
    subject?: unknown;
    body?: unknown;
  };
  const contactId =
    typeof body.contactId === "string" ? body.contactId.trim() : "";
  const subject = typeof body.subject === "string" ? body.subject : "";
  const emailBody = typeof body.body === "string" ? body.body : "";

  if (!contactId) {
    return NextResponse.json(
      { ok: false, error: "contactId is required.", code: "missing_contact_id" },
      { status: 400 },
    );
  }

  const result = await sendEmailForAgent({
    agentId,
    contactId,
    subject,
    body: emailBody,
  });
  if (result.ok === false) {
    return NextResponse.json(
      { ok: false, error: result.error, code: result.code },
      { status: result.status ?? 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    delivered: result.delivered,
    externalMessageId: result.externalMessageId,
  });
}
