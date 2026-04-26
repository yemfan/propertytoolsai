import { NextResponse } from "next/server";

import { validateTwilioSignature, xmlResponse } from "@/lib/ai-call";
import { buildOutboundDemoTwiml } from "@/lib/voice-ai-demo/twiml";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * TwiML endpoint Twilio fetches when the recipient picks up an outbound
 * voice-AI demo call (placed by `dispatchOutboundDemoCall`). Returns a
 * demo-specific greeting + speech gather, with the gather action pointing
 * to the existing inbound speech-handler route — so once the prospect
 * speaks, the same AI engine the production CRM uses takes over.
 *
 * Twilio always POSTs (with form-encoded body); the route handles GET as
 * a safety fallback so accidental browser visits return TwiML instead of
 * 404. Both share the same response.
 */

const INBOUND_SPEECH_PATH = "/api/twilio/voice/inbound";

function publicSpeechActionUrl(req: Request): string {
  const base = (process.env.APP_BASE_URL || "").replace(/\/$/, "");
  if (base) return `${base}${INBOUND_SPEECH_PATH}`;
  // Fallback to same-origin if APP_BASE_URL isn't set — works in dev too.
  const origin = new URL(req.url).origin;
  return `${origin}${INBOUND_SPEECH_PATH}`;
}

async function formRecord(req: Request): Promise<Record<string, string>> {
  try {
    const formData = await req.formData();
    return Object.fromEntries(
      Array.from(formData.entries()).map(([k, v]) => [k, String(v)]),
    );
  } catch {
    return {};
  }
}

async function handle(req: Request) {
  // Twilio webhook signature validation. Same envelope as the inbound route.
  if (req.method === "POST") {
    const formParams = await formRecord(req);
    const signature = req.headers.get("x-twilio-signature") || "";
    const authToken = process.env.TWILIO_AUTH_TOKEN || "";
    const base = (process.env.APP_BASE_URL || "").replace(/\/$/, "");
    const url = base ? `${base}${new URL(req.url).pathname}` : "";

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
  }

  const xml = buildOutboundDemoTwiml({
    gatherActionUrl: publicSpeechActionUrl(req),
  });
  return xmlResponse(xml);
}

export async function POST(req: Request) {
  return handle(req);
}

export async function GET(req: Request) {
  return handle(req);
}
