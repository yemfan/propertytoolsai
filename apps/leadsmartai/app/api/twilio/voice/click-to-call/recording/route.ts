import { NextResponse } from "next/server";
import { validateTwilioSignature } from "@/lib/ai-call";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/twilio/voice/click-to-call/recording?logId=
 *
 * Recording status callback. Fires when the recorded leg is ready
 * (status='completed'). Twilio sends `RecordingUrl` and
 * `RecordingDuration`; we stamp them onto the call_logs row.
 *
 * Privacy / compliance:
 *   - Two-party-consent states require BOTH parties to be aware.
 *     The agent is aware (they enabled recording in settings).
 *     The lead must be informed — typical pattern is a recorded
 *     announcement at the start of the bridged leg ("This call may
 *     be recorded for quality purposes."). Adding that announcement
 *     is a separate enhancement; for now, agents in two-party-consent
 *     states should leave recording OFF until we add the prompt.
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
    const recordingUrl = formParams.RecordingUrl || "";
    if (!logId || !recordingUrl) {
      return new NextResponse(null, { status: 200 });
    }

    await supabaseAdmin
      .from("call_logs")
      .update({ recording_url: recordingUrl })
      .eq("id", logId);

    return new NextResponse(null, { status: 200 });
  } catch (e) {
    console.error("[click-to-call/recording]", e);
    return new NextResponse(null, { status: 200 });
  }
}
