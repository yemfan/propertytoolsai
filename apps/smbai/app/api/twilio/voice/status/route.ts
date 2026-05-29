/**
 * Twilio call-status callback — POST /api/twilio/voice/status
 *
 * Receives the final call status from Twilio after a call ends. Captures
 * CallDuration (seconds) and RecordingUrl (if recording is enabled on the
 * Twilio phone number) and persists them to voice_sessions.
 *
 * Setup: in the Twilio console, set the "Call Status Changes" webhook on your
 * phone number to: https://<app>/api/twilio/voice/status
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const callSid      = formData.get("CallSid")      as string | null;
  const callDuration = formData.get("CallDuration") as string | null; // seconds as string
  const recordingUrl = formData.get("RecordingUrl") as string | null;

  if (!callSid) return new NextResponse(null, { status: 204 });

  const update: Record<string, unknown> = {};
  if (callDuration) update.duration_seconds = parseInt(callDuration, 10);
  if (recordingUrl) update.recording_url = recordingUrl;

  if (Object.keys(update).length > 0) {
    const db = createServiceClient();
    await db.from("voice_sessions").update(update).eq("call_sid", callSid);
  }

  return new NextResponse(null, { status: 204 });
}
