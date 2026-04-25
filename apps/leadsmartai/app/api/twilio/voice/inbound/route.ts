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
import {
  getOrInitSettings as getMissedCallSettings,
  getAgentForwardingInfo,
  toE164,
} from "@/lib/missed-call/service";
import { buildDialForwardingTwiml } from "@/lib/missed-call/twiml";

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

    // Branch: when the agent has missed-call text-back enabled AND
    // a forwarding number on file, dial them instead of jumping
    // straight to the AI receptionist. The dial action callback
    // fires either way — on pickup, the call connects normally; on
    // miss, the dial-result handler sends the auto-SMS. Falling
    // through to the AI receptionist when missed-call is disabled
    // preserves the existing behavior for agents who haven't opted
    // in yet.
    const missedCallSettings = await getMissedCallSettings(start.agentId);
    if (missedCallSettings.enabled) {
      const agentInfo = await getAgentForwardingInfo(start.agentId);
      const forwardingE164 = toE164(agentInfo?.forwarding_phone ?? null);
      const inboundCallerE164 = toE164(formParams.From || "");
      const twilioNumberE164 = toE164(formParams.To || "");

      if (forwardingE164) {
        const base = (process.env.APP_BASE_URL || "").replace(/\/$/, "");
        const dialResultUrl = `${base}/api/twilio/voice/dial-result?agentId=${encodeURIComponent(
          start.agentId,
        )}`;
        return xmlResponse(
          buildDialForwardingTwiml({
            forwardingPhoneE164: forwardingE164,
            actionUrl: dialResultUrl,
            timeoutSeconds: missedCallSettings.ring_timeout_seconds,
            inboundCallerE164,
            twilioNumberE164: twilioNumberE164 ?? undefined,
          }),
        );
      }
      // missed-call enabled but no forwarding number — log and
      // fall through to AI receptionist rather than failing silently.
      console.warn(
        `[twilio/voice/inbound] missed-call enabled but agent ${start.agentId} has no forwarding_phone`,
      );
    }

    const voiceSettings = await getAgentVoiceSettings(start.agentId);
    const playback = resolveTwilioVoicePlayback(voiceSettings);

    const actionUrl = `${(process.env.APP_BASE_URL || "").replace(/\/$/, "")}/api/twilio/voice/inbound`;
    return xmlResponse(buildInboundGatherTwiml(actionUrl, playback));
  } catch (e) {
    console.error("[twilio/voice/inbound]", e);
    return xmlResponse(buildSafeFallbackTwiml());
  }
}
