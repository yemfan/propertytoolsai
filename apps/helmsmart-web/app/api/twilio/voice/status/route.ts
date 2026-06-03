/**
 * Twilio call-status callback — POST /api/twilio/voice/status
 *
 * Receives the final call status from Twilio after a call ends. Captures
 * CallDuration (seconds) and RecordingUrl (if recording is enabled on the
 * Twilio phone number) and persists them to voice_sessions, then bills the
 * org via Stripe invoice item (active subscriptions only).
 *
 * Setup: in the Twilio console, set the "Call Status Changes" webhook on your
 * phone number to: https://<app>/api/twilio/voice/status
 */

import { NextRequest, NextResponse, after } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { billVoiceCall } from "@/lib/voice-billing";

async function handleRequest(request: NextRequest) {
  let callSid: string | null = null;
  let callDuration: string | null = null;
  let recordingUrl: string | null = null;

  try {
    if (request.method === "POST") {
      const formData = await request.formData();
      callSid = formData.get("CallSid") as string | null;
      callDuration = formData.get("CallDuration") as string | null; // seconds as string
      recordingUrl = formData.get("RecordingUrl") as string | null;
    } else {
      // GET request — extract from URL params (for health checks)
      const url = new URL(request.url);
      callSid = url.searchParams.get("CallSid");
      callDuration = url.searchParams.get("CallDuration");
      recordingUrl = url.searchParams.get("RecordingUrl");
    }
  } catch {
    // If form parsing fails, return empty response
    return new NextResponse(null, { status: 204 });
  }

  if (!callSid) return new NextResponse(null, { status: 204 });

  const update: Record<string, unknown> = {};
  const durationSeconds = callDuration ? parseInt(callDuration, 10) : null;
  if (durationSeconds) update.duration_seconds = durationSeconds;
  if (recordingUrl) update.recording_url = recordingUrl;

  if (Object.keys(update).length > 0) {
    const db = await createServiceClient();
    await db.from("voice_sessions").update(update).eq("call_sid", callSid);
  }

  if (durationSeconds) after(() => billVoiceCall(callSid, durationSeconds));

  return new NextResponse(null, { status: 204 });
}

export async function POST(request: NextRequest) {
  return handleRequest(request);
}

export async function GET(request: NextRequest) {
  return handleRequest(request);
}
