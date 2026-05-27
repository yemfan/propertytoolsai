/**
 * Twilio SMS Webhook — POST /api/twilio/sms
 *
 * Configure in Twilio console:
 *   Messaging → Phone Number → "A message comes in" → Webhook → https://your-domain/api/twilio/sms
 *
 * Stores inbound SMS as a message in the inbox.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { createNotificationService } from "@/lib/actions/notifications";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const from = formData.get("From") as string | null;
  const to   = formData.get("To")   as string | null;
  const body = formData.get("Body") as string | null;
  const sid  = formData.get("MessageSid") as string | null;

  if (!from || !to || !body) {
    return new NextResponse("<?xml version=\"1.0\"?><Response/>", {
      headers: { "Content-Type": "text/xml" },
    });
  }

  const supabase = createServiceClient();

  // Find org by Twilio number
  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .eq("twilio_number", to)
    .single();

  if (org) {
    // Find client by phone number
    const { data: client } = await supabase
      .from("clients")
      .select("id")
      .eq("organization_id", org.id)
      .eq("phone", from)
      .maybeSingle();

    await supabase.from("messages").insert({
      organization_id: org.id,
      client_id: client?.id ?? null,
      channel: "sms",
      direction: "inbound",
      from_address: from,
      to_address: to,
      body,
      read: false,
      external_id: sid,
      sent_at: new Date().toISOString(),
    });

    // Notify the dashboard
    await createNotificationService(org.id, {
      type: "new_message",
      title: "New SMS received",
      body: body.length > 80 ? body.slice(0, 77) + "…" : body,
      link: "/inbox",
    });
  }

  // Respond with empty TwiML (no auto-reply — handled separately)
  return new NextResponse("<?xml version=\"1.0\"?><Response/>", {
    headers: { "Content-Type": "text/xml" },
  });
}
