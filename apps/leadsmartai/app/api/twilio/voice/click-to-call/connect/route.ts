import { NextResponse } from "next/server";
import { validateTwilioSignature, xmlResponse } from "@/lib/ai-call";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/twilio/voice/click-to-call/connect?logId=&toE164=&record=
 *
 * Fired by Twilio when the AGENT picks up the click-to-call leg.
 * Returns TwiML that bridges to the LEAD's number, with optional
 * recording.
 *
 * The querystring carries:
 *   - logId: our call_logs.id, so the status callback can find it
 *     and also so this handler can mark "in-progress" with the
 *     agent's leg connected.
 *   - toE164: the lead's phone in E.164. We validate ownership at
 *     start-time (in startClickToCall); by the time this fires the
 *     agent has already authenticated. Re-resolving here would be
 *     belt-and-braces but adds a DB round-trip per call.
 *   - record: when "1", record the bridged call.
 *
 * Caller ID on the bridged leg is the Twilio number (the From of
 * the parent call) so the lead sees the agent's CRM number, not
 * the agent's personal cell.
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

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
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

    const u = new URL(req.url);
    const logId = u.searchParams.get("logId") || "";
    const toE164 = u.searchParams.get("toE164") || "";
    const record = u.searchParams.get("record") === "1";

    if (!logId || !toE164) {
      console.warn("[click-to-call/connect] missing logId or toE164");
      return xmlResponse(
        `<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>`,
      );
    }

    // Touch the log row so the agent-leg pickup is visible in the
    // activity feed even if the lead never picks up.
    await supabaseAdmin
      .from("call_logs")
      .update({
        status: "in-progress",
        notes: "Agent picked up; bridging to lead.",
      })
      .eq("id", logId);

    // Caller ID is the Twilio number — Twilio will re-use the
    // parent leg's `From` automatically when callerId is omitted
    // from <Dial>, so we don't need to set it explicitly.
    //
    // Recording attributes:
    //   record="record-from-answer-dual" — both legs, separate
    //     channels, started when the lead answers. (Best for
    //     review later — agent + lead are easy to distinguish.)
    //   recordingStatusCallback — fires when the recording is
    //     ready; our handler writes recording_url to call_logs.
    const recordAttrs = record
      ? ` record="record-from-answer-dual" recordingStatusCallback="${escapeXml(
          (process.env.APP_BASE_URL || "").replace(/\/$/, "") +
            `/api/twilio/voice/click-to-call/recording?logId=${encodeURIComponent(logId)}`,
        )}" recordingStatusCallbackEvent="completed"`
      : "";

    const twiml = [
      `<?xml version="1.0" encoding="UTF-8"?>`,
      `<Response>`,
      `  <Dial answerOnBridge="true" timeout="40"${recordAttrs}>`,
      `    <Number>${escapeXml(toE164)}</Number>`,
      `  </Dial>`,
      `</Response>`,
    ].join("\n");

    return xmlResponse(twiml);
  } catch (e) {
    console.error("[click-to-call/connect]", e);
    return xmlResponse(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>`,
    );
  }
}
