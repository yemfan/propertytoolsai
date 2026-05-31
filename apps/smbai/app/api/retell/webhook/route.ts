/**
 * Retell webhook — POST /api/retell/webhook
 *
 * Retell calls this after a call ends to send call summary, transcript,
 * and metadata. We store this in voice_sessions for later reference.
 *
 * Setup: in Retell agent settings, set "Webhook URL" to:
 * https://<app>/api/retell/webhook
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Extract call data from Retell webhook
    const callId = body.call_id || body.callId;
    const summary = body.summary;
    const transcript = body.transcript;
    const recordingUrl = body.recording_url || body.recordingUrl;
    const duration = body.call_duration || body.duration;

    // If there's a call ID, update the session with results
    if (callId) {
      const db = createServiceClient();

      // Update voice session with call results
      const update: Record<string, unknown> = {};
      if (summary) update.summary = summary;
      if (transcript) update.messages = transcript; // Store transcript in messages
      if (recordingUrl) update.recording_url = recordingUrl;
      if (duration) update.duration_seconds = duration;

      // Mark as completed
      update.status = "completed";

      await db
        .from("voice_sessions")
        .update(update)
        .eq("call_sid", callId)
        .or(`call_sid.eq.${callId},id.eq.${callId}`);
    }

    // Return success for all requests (including test/empty payloads)
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Retell webhook error:", error);
    // Return success anyway so Retell doesn't retry
    return NextResponse.json({ success: true });
  }
}
