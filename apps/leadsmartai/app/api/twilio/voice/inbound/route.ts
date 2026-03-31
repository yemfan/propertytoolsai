import { NextResponse } from "next/server";
import {
  buildClosingTwiml,
  buildInboundGatherTwiml,
  buildSafeFallbackTwiml,
  processGatheredSpeech,
  handleInboundWebhookStart,
  xmlResponse,
  validateTwilioSignature,
} from "@/lib/ai-call";
import { getAgentVoiceSettings } from "@/lib/agent-voice/settings";
import { resolveTwilioVoicePlayback } from "@/lib/agent-voice/resolvePlayback";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function publicWebhookUrl(req: Request) {
  const base = (process.env.APP_BASE_URL || "").replace(/\/$/, "");
  if (!base) return "";
  return `${base}${new URL(req.url).pathname}`;
}

async function formRecord(req: Request) {
  const formData = await req.formData();
  return Object.fromEntries(Array.from(formData.entries()).map(([k, v]) => [k, String(v)]));
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

    const speechResult = (formParams.SpeechResult || "").trim();
    const callSid = formParams.CallSid || "";

    if (speechResult && callSid) {
      const result = await processGatheredSpeech({
        twilioCallSid: callSid,
        speechResult,
        callStatus: formParams.CallStatus || null,
      });
      if (result.ok) {
        const voiceSettings = await getAgentVoiceSettings(result.agentId);
        const playback = resolveTwilioVoicePlayback(voiceSettings);
        return xmlResponse(buildClosingTwiml(result.voiceLanguage, playback));
      }
      return xmlResponse(buildClosingTwiml("en"));
    }

    if (!callSid) {
      return xmlResponse(buildSafeFallbackTwiml());
    }

    const start = await handleInboundWebhookStart({
      twilioCallSid: callSid,
      twilioAccountSid: formParams.AccountSid || null,
      fromRaw: formParams.From || "",
      toRaw: formParams.To || "",
      callStatus: formParams.CallStatus || null,
    });

    const voiceSettings = await getAgentVoiceSettings(start.agentId);
    const playback = resolveTwilioVoicePlayback(voiceSettings);

    const actionUrl = `${(process.env.APP_BASE_URL || "").replace(/\/$/, "")}/api/twilio/voice/inbound`;
    return xmlResponse(buildInboundGatherTwiml(actionUrl, playback));
  } catch (e) {
    console.error("[twilio/voice/inbound]", e);
    return xmlResponse(buildSafeFallbackTwiml());
  }
}
