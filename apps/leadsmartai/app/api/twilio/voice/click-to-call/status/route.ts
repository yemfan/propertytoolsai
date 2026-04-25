import { NextResponse } from "next/server";
import { validateTwilioSignature } from "@/lib/ai-call";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/twilio/voice/click-to-call/status?logId=
 *
 * Status callback registered when we initiated the parent call.
 * Twilio fires this on each milestone in `statusCallbackEvent`:
 *   - initiated → call queued
 *   - ringing   → agent's phone is ringing
 *   - answered  → agent picked up
 *   - completed → call is fully done; CallDuration available
 *
 * We just patch the call_logs row with the latest status + duration.
 * Recording URL is captured via a separate handler (see `recording`).
 *
 * Returns 200 OK with empty body — Twilio doesn't expect TwiML for
 * status callbacks.
 */
function publicWebhookUrl(req: Request) {
  const base = (process.env.APP_BASE_URL || "").replace(/\/$/, "");
  if (!base) return "";
  const u = new URL(req.url);
  return `${base}${u.pathname}${u.search}`;
}

async function formRecord(req: Request) {
  const formData = await req.formData();
  return Object.fromEntries(
    Array.from(formData.entries()).map(([k, v]) => [k, String(v)]),
  );
}

export async function POST(req: Request) {
  try {
    const formParams = await formRecord(req);
    const signature = req.headers.get("x-twilio-signature") || "";
    const authToken = process.env.TWILIO_AUTH_TOKEN || "";
    const url = publicWebhookUrl(req);

    if (
      process.env.NODE_ENV === "production" &&
      process.env.TWILIO_VALIDATE_WEBHOOK !== "false" &&
      authToken &&
      url
    ) {
      if (!validateTwilioSignature({ authToken, signature, url, formParams })) {
        return new NextResponse("Forbidden", { status: 403 });
      }
    }

    const logId = new URL(req.url).searchParams.get("logId") || "";
    if (!logId) {
      return new NextResponse(null, { status: 200 });
    }

    const callStatus = (formParams.CallStatus || "").toLowerCase();
    const callDuration = Number(formParams.CallDuration || "");

    const patch: Record<string, unknown> = { status: callStatus };
    if (Number.isFinite(callDuration) && callDuration > 0) {
      patch.duration_seconds = Math.round(callDuration);
    }

    await supabaseAdmin.from("call_logs").update(patch).eq("id", logId);

    return new NextResponse(null, { status: 200 });
  } catch (e) {
    console.error("[click-to-call/status]", e);
    return new NextResponse(null, { status: 200 });
  }
}
