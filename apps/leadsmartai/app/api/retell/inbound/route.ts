import { NextRequest, NextResponse, after } from "next/server";
import { resolveVoiceAgentId } from "@/lib/ai-call/lead-resolution";
import { loadReceptionistContext } from "@/lib/voice-agent/context";
import { resolveAgentIdByReceptionistNumber } from "@/lib/voice-receptionist/settings";
import { sendSMS } from "@/lib/twilioSms";
import { buildReceptionistDynamicVariables, type ReceptionistContext } from "@repo/voice";

/**
 * Follow-up text to the caller after a forwarded (missed) call reaches the AI —
 * runs after the response so it never blocks Retell. Sends from TWILIO_FROM_NUMBER,
 * so that env must be an SMS-capable number (a toll-free with rejected verification
 * can't text). No-ops on a missing/invalid caller number.
 */
function sendCallerTextBack(ctx: ReceptionistContext, fromNumber: string) {
  const digits = (fromNumber || "").replace(/\D/g, "");
  if (digits.length !== 10 && digits.length !== 11) return;
  const to = digits.length === 10 ? `+1${digits}` : `+${digits}`;
  const who = ctx.agentName
    ? `This is ${ctx.agentName}, ${ctx.orgName}'s virtual assistant.`
    : `This is ${ctx.orgName}'s virtual assistant.`;
  const message = `Thanks for calling ${ctx.orgName}! ${who} We'll follow up shortly — reply here anytime. Reply STOP to opt out.`;
  after(async () => {
    try {
      await sendSMS(to, message);
    } catch (e) {
      console.error("retell/inbound: caller text-back failed", e);
    }
  });
}

/**
 * Retell inbound-call webhook (LeadSmart) — POST /api/retell/inbound
 *
 * Additive, opt-in: a parallel Retell-based receptionist that reuses the shared
 * @repo/voice prompt core. It resolves the agent from the dialed number using
 * the existing VOICE_INBOUND_AGENT_MAP logic, then hands Retell the per-agent
 * dynamic variables built by the shared builder. LeadSmart's existing
 * Twilio/OpenAI-Realtime voice (/api/twilio/voice/inbound) is untouched — point
 * a number's Retell inbound webhook here to use the Retell receptionist instead.
 *
 * Must be fast (Retell's timeout is ~10s) and return string→string values only.
 * Retell can't sign this webhook, so gate with ?k=<RETELL_FUNCTION_SECRET>.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.RETELL_FUNCTION_SECRET;
  if (secret && req.nextUrl.searchParams.get("k") !== secret) {
    return NextResponse.json({ call_inbound: { dynamic_variables: {} } }, { status: 401 });
  }

  let toNumber = "";
  let fromNumber = "";
  try {
    const body = await req.json();
    toNumber = String(body?.call_inbound?.to_number ?? "");
    fromNumber = String(body?.call_inbound?.from_number ?? "");
  } catch {
    /* malformed body — fall through to empty vars */
  }

  let dynamic_variables: Record<string, string> = {};
  // Dynamic multi-tenant routing: the dialed number -> the agent whose config
  // owns it (each agent's config row stores its receptionist number).
  // resolveVoiceAgentId (VOICE_INBOUND_AGENT_MAP / default env) is the fallback.
  const agentId =
    (await resolveAgentIdByReceptionistNumber(toNumber)) ||
    (await resolveVoiceAgentId(toNumber));
  if (agentId) {
    try {
      const ctx = await loadReceptionistContext(agentId);
      if (ctx) {
        dynamic_variables = buildReceptionistDynamicVariables(ctx);
        sendCallerTextBack(ctx, fromNumber);
      }
    } catch (err) {
      // Never 500 on Retell — fall back to empty variables.
      console.error("retell/inbound: failed to build receptionist context", err);
    }
  }

  return NextResponse.json({ call_inbound: { dynamic_variables } });
}
