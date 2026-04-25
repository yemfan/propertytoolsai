import { NextResponse } from "next/server";
import { validateTwilioSignature, xmlResponse } from "@/lib/ai-call";
import { handleMissedCall } from "@/lib/missed-call/service";
import { buildDialResultHangupTwiml } from "@/lib/missed-call/twiml";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/twilio/voice/dial-result?agentId=...
 *
 * Action callback fired by the inbound webhook's `<Dial>` after the
 * agent's leg ends. Twilio sends `DialCallStatus` in the form body:
 *
 *   - "completed"  → agent picked up; nothing for us to do.
 *   - "no-answer"  → ring timeout exceeded.
 *   - "busy"       → agent's line was busy.
 *   - "failed"     → unreachable / wrong number / device off.
 *   - "canceled"   → caller hung up before ring timeout.
 *
 * For the three "agent didn't pick up" outcomes we trigger the
 * auto-text-back via `handleMissedCall`. "canceled" we treat as a
 * miss too — the lead bailed, but they'll still appreciate the
 * follow-up SMS.
 *
 * agentId comes via querystring because Twilio doesn't preserve
 * arbitrary application state across legs. We don't trust it
 * blindly — we ALSO match on the call SID's parent record (created
 * in the inbound webhook by handleInboundWebhookStart) for the
 * eventual paranoid-mode hardening. For now: agentId is signed by
 * the Twilio signature on the URL, which is enough.
 */

function publicWebhookUrl(req: Request) {
  const base = (process.env.APP_BASE_URL || "").replace(/\/$/, "");
  if (!base) return "";
  // Include the full URL with querystring — Twilio computes the
  // signature over the URL exactly as it called.
  const u = new URL(req.url);
  return `${base}${u.pathname}${u.search}`;
}

async function formRecord(req: Request) {
  const formData = await req.formData();
  return Object.fromEntries(
    Array.from(formData.entries()).map(([k, v]) => [k, String(v)]),
  );
}

const MISSED_STATUSES = new Set([
  "no-answer",
  "busy",
  "failed",
  "canceled",
]);

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

    const dialStatus = (formParams.DialCallStatus || "").toLowerCase();
    const callerPhone = formParams.From || "";
    const twilioCallSid = formParams.CallSid || "";

    const agentId = new URL(req.url).searchParams.get("agentId") || "";
    if (!agentId) {
      console.warn("[dial-result] missing agentId in querystring");
      return xmlResponse(buildDialResultHangupTwiml());
    }

    if (MISSED_STATUSES.has(dialStatus)) {
      const result = await handleMissedCall({
        agentId,
        callerPhone,
        twilioCallSid,
      });
      console.info(
        `[dial-result] missed call handled — agentId=${agentId} callerPhone=${callerPhone} status=${dialStatus} smsSent=${result.smsSent} logId=${result.logId}`,
      );
    }

    // Always return a hangup — the dial leg is over.
    return xmlResponse(buildDialResultHangupTwiml());
  } catch (e) {
    console.error("[dial-result]", e);
    return xmlResponse(buildDialResultHangupTwiml());
  }
}
