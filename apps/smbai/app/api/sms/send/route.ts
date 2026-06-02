/**
 * POST /api/sms/send  { clientId, to, body }
 *
 * Sends an SMS for the HelmSmart AI panel via the existing org-scoped
 * sendSms() server action (Twilio + logs to messages). Returns the
 * { success } envelope the widget expects.
 */

import { NextRequest, NextResponse } from "next/server";
import { sendSms } from "@/lib/actions/messages";

export async function POST(request: NextRequest) {
  let clientId: string | null = null;
  let to = "";
  let body = "";
  try {
    const json = await request.json();
    clientId = json.clientId ? String(json.clientId) : null;
    to = String(json.to ?? "").trim();
    body = String(json.body ?? "").trim();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  if (!to) return NextResponse.json({ success: false, error: "This contact has no phone number." }, { status: 400 });
  if (!body) return NextResponse.json({ success: false, error: "Message is empty." }, { status: 400 });

  try {
    await sendSms(clientId, to, body);
    return NextResponse.json({ success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not send the SMS.";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
