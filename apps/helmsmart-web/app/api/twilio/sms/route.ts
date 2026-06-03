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
import Anthropic from "@anthropic-ai/sdk";
import { createServiceClient } from "@/lib/supabase/server";
import { shouldStopMessaging } from "@helm/dna-communication";
import { createNotificationService } from "@/lib/actions/notifications";
import { analyzeInbound, translateToEnglish, localizeOutbound, intentLabel, languageName, type Lang } from "@/lib/language";

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
    .select("id, name, auto_reply, auto_reply_msg, owner_english_assist")
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

    // auto_pilot lives on clients (migration 00045). Read it best-effort so a
    // not-yet-migrated DB degrades to the canned auto-reply instead of erroring
    // the whole inbound flow.
    let clientAutoPilot = false;
    if (client) {
      const { data: ap } = await supabase
        .from("clients")
        .select("auto_pilot")
        .eq("id", client.id)
        .maybeSingle();
      clientAutoPilot = Boolean((ap as { auto_pilot?: boolean } | null)?.auto_pilot);
    }

    // Per-client AI Auto Pilot takes precedence over the canned org auto-reply:
    // if this client has auto_pilot on, send a contextual AI reply instead of
    // the static acknowledgement.
    if (client && clientAutoPilot && !shouldStopMessaging(body)) {
      await runAutoPilotReply({
        supabase,
        orgId: org.id,
        orgName: org.name ?? "our business",
        clientId: client.id,
        from,
        to,
        lang,
        assist,
      });
    } else if (org.auto_reply && !shouldStopMessaging(body)) {
      // Opt-out (STOP/unsubscribe/…): message is still captured + triaged, but no auto-reply (TCPA).
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

/**
 * HelmSmart AI Auto Pilot — when a client has auto_pilot on, draft a contextual
 * reply with Claude and send it via Twilio. Best-effort: any failure leaves the
 * inbound captured + owner notified. A 5-message / 10-minute circuit breaker
 * prevents runaway loops with an automated counterpart.
 */
async function runAutoPilotReply(opts: {
  supabase: ReturnType<typeof createServiceClient>;
  orgId: string;
  orgName: string;
  clientId: string;
  from: string;
  to: string;
  lang: Lang;
  assist: boolean;
}) {
  const { supabase, orgId, orgName, clientId, from, to, lang, assist } = opts;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return;

  const tenMinAgo = new Date(Date.now() - 10 * 60_000).toISOString();
  const { count } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .eq("direction", "outbound")
    .eq("to_address", from)
    .gt("sent_at", tenMinAgo);
  if ((count ?? 0) >= 5) return;

  const { data: recent } = await supabase
    .from("messages")
    .select("direction, body")
    .eq("organization_id", orgId)
    .eq("client_id", clientId)
    .eq("channel", "sms")
    .order("sent_at", { ascending: false })
    .limit(8);
  const transcript = (recent ?? [])
    .slice()
    .reverse()
    .map((m) => `${m.direction === "inbound" ? "Customer" : orgName}: ${m.body}`)
    .join("\n");

  const langRule =
    lang === "en"
      ? "Write the reply in English."
      : assist
        ? `Write the reply in ${languageName(lang)}, then add an English translation after a blank line.`
        : `Write the reply entirely in ${languageName(lang)}.`;

  let replyText = "";
  try {
    const anthropic = new Anthropic({ apiKey });
    const resp = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 400,
      system: `You are replying on behalf of the business "${orgName}" to a customer's text message. Reply helpfully and concisely (under 320 characters). ${langRule} Address their latest message directly. Return ONLY the reply text — no greeting placeholder like "[Name]", no signature.`,
      messages: [
        {
          role: "user",
          content: `Conversation (most recent last):\n${transcript}\n\nWrite the next reply from ${orgName}.`,
        },
      ],
    });
    replyText = (resp.content[0] as { type: string; text?: string }).text?.trim() ?? "";
    replyText = replyText.replace(/^["']|["']$/g, "").trim();
  } catch {
    return;
  }
  if (!replyText) return;

  try {
    const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);
    await twilioClient.messages.create({ from: to, to: from, body: replyText });
    await supabase.from("messages").insert({
      organization_id: orgId,
      client_id: clientId,
      channel: "sms",
      direction: "outbound",
      from_address: to,
      to_address: from,
      body: replyText,
      read: true,
      sent_at: new Date().toISOString(),
    });
  } catch {
    // send failed — inbound still captured + owner notified
  }
}
