import { NextResponse } from "next/server";
import {
  appendLeadCallEvent,
  getCallByTwilioSid,
  normalizeTwilioStatusToInternal,
  updateLeadCallStatus,
  validateTwilioSignature,
} from "@/lib/ai-call";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function publicWebhookUrl(req: Request) {
  const base = (process.env.APP_BASE_URL || "").replace(/\/$/, "");
  if (!base) return "";
  return `${base}${new URL(req.url).pathname}`;
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const formParams = Object.fromEntries(
      Array.from(formData.entries()).map(([k, v]) => [k, String(v)])
    );

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

    const callSid = formParams.CallSid || "";
    const rawStatus = formParams.CallStatus || null;
    const duration = formParams.CallDuration ? Number(formParams.CallDuration) : null;
    const recordingUrl = formParams.RecordingUrl || null;

    if (!callSid) {
      return NextResponse.json({ ok: true });
    }

    const internal = normalizeTwilioStatusToInternal(rawStatus);
    const completed = internal === "completed" || internal === "failed" || internal === "no_answer";

    await updateLeadCallStatus({
      twilioCallSid: callSid,
      status: internal,
      durationSeconds: Number.isFinite(duration) ? duration : null,
      recordingUrl: recordingUrl || null,
      endedAt: completed,
    });

    const row = await getCallByTwilioSid(callSid);
    if (row) {
      await appendLeadCallEvent({
        leadCallId: row.id,
        eventType: "twilio_status",
        metadataJson: {
          callStatus: rawStatus,
          duration,
          recordingUrl: recordingUrl || null,
        },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[twilio/voice/status]", e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
