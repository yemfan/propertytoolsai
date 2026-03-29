import { NextRequest, NextResponse } from "next/server";
import { validateTwilioSignature } from "@/lib/ai-sms/twilio";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function twilioWebhookPublicUrl(req: Request) {
  const base = (process.env.APP_BASE_URL || "").replace(/\/$/, "");
  if (!base) return "";
  const path = new URL(req.url).pathname;
  return `${base}${path}`;
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const formParams = Object.fromEntries(Array.from(form.entries()).map(([k, v]) => [k, String(v)]));

    const signature = req.headers.get("x-twilio-signature") || "";
    const authToken = process.env.TWILIO_AUTH_TOKEN || "";
    const publicWebhookUrl = twilioWebhookPublicUrl(req);

    if (
      process.env.NODE_ENV === "production" &&
      process.env.TWILIO_VALIDATE_WEBHOOK !== "false" &&
      authToken &&
      publicWebhookUrl
    ) {
      const ok = validateTwilioSignature({
        authToken,
        signature,
        url: publicWebhookUrl,
        formParams,
      });
      if (!ok) {
        return new NextResponse("Invalid signature", { status: 403 });
      }
    }

    const messageSid = String(formParams.MessageSid || "");
    const messageStatus = String(formParams.MessageStatus || "");
    const errorCode = String(formParams.ErrorCode || "");
    const errorMessage = String(formParams.ErrorMessage || "");

    if (!messageSid) {
      return new NextResponse("Missing MessageSid", { status: 400 });
    }

    const patch: Record<string, unknown> = {
      twilio_status: messageStatus || null,
      delivery_error_code: errorCode || null,
      delivery_error_message: errorMessage || null,
    };

    const { error } = await supabaseAdmin
      .from("sms_messages")
      .update(patch)
      .eq("external_message_id", messageSid);

    if (error) {
      console.error("sms status: update failed", error);
    }

    return new NextResponse("ok", { status: 200 });
  } catch (e) {
    console.error("sms status callback error:", e);
    return new NextResponse("error", { status: 500 });
  }
}
