import { NextResponse } from "next/server";
import { buildMediaStreamConnectTwiML, xmlResponse } from "@/lib/ai-call";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Placeholder for Twilio Media Streams + OpenAI Realtime.
 *
 * Twilio will open a **WebSocket** to your bridge URL — not to this Next.js route.
 * Deploy a small Node/Fly/ECS worker that:
 * 1. Accepts Twilio Media Stream `start` / `media` / `stop` frames
 * 2. Forwards audio to OpenAI Realtime (or another ASR/TTS stack)
 * 3. Streams synthesized audio back on the same Twilio WS
 *
 * This route only returns TwiML `<Connect><Stream url="wss://..."/>` when configured.
 */
export async function GET() {
  return NextResponse.json({
    service: "leadsmart-media-stream-placeholder",
    hint: "Set TWILIO_MEDIA_STREAM_WSS_URL for POST TwiML; run WS bridge separately.",
  });
}

export async function POST() {
  const wss = process.env.TWILIO_MEDIA_STREAM_WSS_URL?.trim();
  if (!wss) {
    return xmlResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Joanna">Media stream bridge is not configured.</Say><Hangup/></Response>'
    );
  }
  return xmlResponse(buildMediaStreamConnectTwiML(wss));
}
