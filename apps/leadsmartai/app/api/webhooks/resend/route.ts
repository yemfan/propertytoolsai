import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { parseResendEvent, type ResendWebhookPayload } from "@/lib/email-tracking/eventMapping";
import { recordEmailEvent } from "@/lib/email-tracking/service";
import { verifySvixSignature } from "@/lib/email-tracking/svix";

/**
 * Resend webhook receiver.
 *
 * Configure in the Resend dashboard:
 *   - URL: https://<host>/api/webhooks/resend
 *   - Events: email.delivered, email.opened, email.clicked, email.bounced,
 *     email.complained, email.delivery_delayed, (optional) email.sent
 *   - Signing secret: stored in env as RESEND_WEBHOOK_SECRET (whsec_...)
 *
 * Returns 200 for any event we successfully record OR silently ignore
 * (unknown event types, unmapped email_id), so Resend doesn't retry
 * forever. Returns 401 on signature failure, 500 on unexpected error.
 */
export async function POST(req: Request) {
  const rawBody = await req.text();
  const h = await headers();
  const svixId = h.get("svix-id");
  const svixTimestamp = h.get("svix-timestamp");
  const svixSignature = h.get("svix-signature");

  const secret = process.env.RESEND_WEBHOOK_SECRET ?? "";
  if (!secret) {
    console.error("[resend-webhook] RESEND_WEBHOOK_SECRET not configured");
    return NextResponse.json({ ok: false, error: "not configured" }, { status: 500 });
  }

  const verification = verifySvixSignature({
    secret,
    rawBody,
    svixId,
    svixTimestamp,
    svixSignature,
  });
  if (!verification.ok) {
    console.warn("[resend-webhook] signature rejected:", verification.reason);
    return NextResponse.json(
      { ok: false, error: "invalid signature" },
      { status: 401 },
    );
  }

  let payload: ResendWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as ResendWebhookPayload;
  } catch {
    return NextResponse.json({ ok: false, error: "bad json" }, { status: 400 });
  }

  const event = parseResendEvent(payload);
  if (!event) {
    // Unknown event type or missing email_id. Log + 200 so Resend
    // marks delivery successful rather than retrying for hours.
    console.info("[resend-webhook] skipping event", { type: payload.type });
    return NextResponse.json({ ok: true, ignored: true });
  }

  try {
    const result = await recordEmailEvent(event, svixId);
    return NextResponse.json({ ok: true, inserted: result.inserted });
  } catch (e) {
    console.error("[resend-webhook] insert error:", e);
    return NextResponse.json({ ok: false, error: "insert failed" }, { status: 500 });
  }
}
