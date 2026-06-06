/**
 * Twilio SMS Status Callback — POST /api/twilio/sms/status
 *
 * Twilio calls this as a message moves through its lifecycle
 * (queued → sent → delivered, or failed/undelivered). We set the
 * statusCallback URL on outbound messages.create() (see sendSms), so this
 * records the real delivery outcome against the row whose external_id matches
 * the Twilio MessageSid. The SMS thread then shows Delivered/Failed instead of
 * a misleading "Sent".
 *
 * Configure: nothing to do in the Twilio console — the callback URL is passed
 * per-message at send time.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyTwilioSignature, formParams } from "@/lib/twilio-verify";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const params = formParams(formData);
  if (!verifyTwilioSignature(request, params)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const sid = params.MessageSid ?? params.SmsSid ?? null;
  const status = params.MessageStatus ?? params.SmsStatus ?? null;
  if (!sid || !status) {
    // Nothing actionable, but ack so Twilio doesn't retry.
    return new NextResponse(null, { status: 204 });
  }

  const supabase = await createServiceClient();
  await supabase
    .from("messages")
    .update({
      twilio_status: status,
      delivery_error_code: params.ErrorCode ?? null,
      delivery_error_message: params.ErrorMessage ?? null,
    })
    .eq("external_id", sid);

  return new NextResponse(null, { status: 204 });
}
