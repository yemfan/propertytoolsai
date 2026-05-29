/**
 * Twilio SMS Webhook — POST /api/twilio/sms
 *
 * Configure in Twilio console:
 *   Messaging → Phone Number → "A message comes in" → Webhook → https://your-domain/api/twilio/sms
 *
 * Stores inbound SMS as a message in the inbox.
 */

import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";
import { createServiceClient } from "@/lib/supabase/server";
import { createNotificationService } from "@/lib/actions/notifications";
import { analyzeInbound, translateToEnglish, localizeOutbound, intentLabel, type Lang } from "@/lib/language";

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
    .select("id, auto_reply, auto_reply_msg, owner_english_assist")
    .eq("twilio_number", to)
    .single();

  if (org) {
    // Find client by phone number
    const { data: client } = await supabase
      .from("clients")
      .select("id, preferred_language")
      .eq("organization_id", org.id)
      .eq("phone", from)
      .maybeSingle();

    // One Haiku call classifies language + intent + urgency together.
    const assist = !!org.owner_english_assist;
    const analysis = await analyzeInbound(body);
    const lang: Lang = (client?.preferred_language as Lang | null) ?? analysis.lang;
    if (client && !client.preferred_language) {
      await supabase.from("clients").update({ preferred_language: lang }).eq("id", client.id);
    }
    // Translate a non-English inbound to English so the owner can read it.
    const translationEn = assist && lang !== "en" ? await translateToEnglish(body) : null;

    await supabase.from("messages").insert({
      organization_id: org.id,
      client_id: client?.id ?? null,
      channel: "sms",
      direction: "inbound",
      from_address: from,
      to_address: to,
      body,
      translation_en: translationEn,
      intent: analysis.intent,
      priority: analysis.priority,
      read: false,
      external_id: sid,
      sent_at: new Date().toISOString(),
    });

    // Triage: auto-create a task for messages that need the owner to act.
    if (analysis.priority === "high" || ["booking", "billing", "complaint"].includes(analysis.intent)) {
      await supabase.from("tasks").insert({
        organization_id: org.id,
        client_id: client?.id ?? null,
        title: `${intentLabel(analysis.intent)} from ${from} — reply needed`,
        notes: (translationEn || body).slice(0, 500),
        due_date: new Date().toISOString().slice(0, 10),
        priority: analysis.priority === "high" ? "high" : "normal",
        status: "open",
      });
    }

    // Notify the dashboard
    await createNotificationService(org.id, {
      type: "new_message",
      title: "New SMS received",
      body: body.length > 80 ? body.slice(0, 77) + "…" : body,
      link: "/inbox",
    });

    // Instant auto-acknowledge so a new lead never sits unanswered. At most once
    // per ~4h per sender — the ack counts as recent outbound, so an active
    // back-and-forth won't get repeatedly auto-replied.
    if (org.auto_reply) {
      const fourHoursAgo = new Date(Date.now() - 4 * 3600_000).toISOString();
      const { count } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", org.id)
        .eq("direction", "outbound")
        .eq("to_address", from)
        .gt("sent_at", fourHoursAgo);
      if (!count) {
        const ackEnglish =
          org.auto_reply_msg?.trim() ||
          "Thanks for reaching out! We got your message and will get back to you shortly.";
        const ackBody = await localizeOutbound(ackEnglish, lang, assist);
        try {
          const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);
          await twilioClient.messages.create({ from: to, to: from, body: ackBody });
          await supabase.from("messages").insert({
            organization_id: org.id,
            client_id: client?.id ?? null,
            channel: "sms",
            direction: "outbound",
            from_address: to,
            to_address: from,
            body: ackBody,
            read: true,
            sent_at: new Date().toISOString(),
          });
        } catch {
          // ack failed — inbound is still captured + owner notified
        }
      }
    }
  }

  // Respond with empty TwiML (any auto-reply is sent above via the REST API)
  return new NextResponse("<?xml version=\"1.0\"?><Response/>", {
    headers: { "Content-Type": "text/xml" },
  });
}
