"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { Resend } from "resend";
import twilio from "twilio";
import Anthropic from "@anthropic-ai/sdk";

const resend = new Resend(process.env.RESEND_API_KEY);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function twilioClient() {
  return twilio(
    process.env.TWILIO_ACCOUNT_SID!,
    process.env.TWILIO_AUTH_TOKEN!
  );
}

// ─── Send email ───────────────────────────────────────────────────────────────

export async function sendEmail(
  clientId: string,
  toEmail: string,
  subject: string,
  body: string
) {
  const cookieStore = await cookies();
  const orgId = cookieStore.get("smbai-org-id")?.value;
  if (!orgId) throw new Error("No org");

  const supabase = await createClient();

  // Get org email domain (use Resend from address)
  const fromAddress = process.env.RESEND_FROM_EMAIL ?? "noreply@smbai.app";

  const { data: sent, error } = await resend.emails.send({
    from: fromAddress,
    to: toEmail,
    subject,
    text: body,
  });

  if (error) throw new Error(error.message);

  await supabase.from("messages").insert({
    organization_id: orgId,
    client_id: clientId,
    channel: "email",
    direction: "outbound",
    from_address: fromAddress,
    to_address: toEmail,
    subject,
    body,
    read: true,
    external_id: sent?.id,
    sent_at: new Date().toISOString(),
  });
}

// ─── Send SMS ─────────────────────────────────────────────────────────────────

export async function sendSms(clientId: string, toNumber: string, body: string) {
  const cookieStore = await cookies();
  const orgId = cookieStore.get("smbai-org-id")?.value;
  if (!orgId) throw new Error("No org");

  const supabase = await createClient();

  // Get org's Twilio number
  const { data: org } = await supabase
    .from("organizations")
    .select("twilio_number")
    .eq("id", orgId)
    .single();

  const fromNumber = org?.twilio_number ?? process.env.TWILIO_FROM_NUMBER;
  if (!fromNumber) throw new Error("No Twilio number configured");

  const client = twilioClient();
  const msg = await client.messages.create({
    from: fromNumber,
    to: toNumber,
    body,
  });

  await supabase.from("messages").insert({
    organization_id: orgId,
    client_id: clientId,
    channel: "sms",
    direction: "outbound",
    from_address: fromNumber,
    to_address: toNumber,
    body,
    read: true,
    external_id: msg.sid,
    sent_at: new Date().toISOString(),
  });
}

// ─── Mark messages read ───────────────────────────────────────────────────────

export async function markThreadRead(clientId: string) {
  const cookieStore = await cookies();
  const orgId = cookieStore.get("smbai-org-id")?.value;
  if (!orgId) return;

  const supabase = await createClient();
  await supabase
    .from("messages")
    .update({ read: true })
    .eq("organization_id", orgId)
    .eq("client_id", clientId)
    .eq("read", false);
}

// ─── Toggle auto-reply ────────────────────────────────────────────────────────

export async function toggleAutoReply(enabled: boolean) {
  const cookieStore = await cookies();
  const orgId = cookieStore.get("smbai-org-id")?.value;
  if (!orgId) return;

  const supabase = await createClient();
  await supabase
    .from("organizations")
    .update({ auto_reply: enabled })
    .eq("id", orgId);
}

export async function saveAutoReplyMsg(msg: string) {
  const cookieStore = await cookies();
  const orgId = cookieStore.get("smbai-org-id")?.value;
  if (!orgId) return;

  const supabase = await createClient();
  await supabase
    .from("organizations")
    .update({ auto_reply_msg: msg })
    .eq("id", orgId);
}

export async function saveTwilioNumber(number: string) {
  const cookieStore = await cookies();
  const orgId = cookieStore.get("smbai-org-id")?.value;
  if (!orgId) return;

  const supabase = await createClient();
  await supabase
    .from("organizations")
    .update({ twilio_number: number })
    .eq("id", orgId);
}

// ─── AI reply draft (Week 57) ─────────────────────────────────────────────────

export async function draftReply(clientId: string, channel: "email" | "sms"): Promise<string> {
  const cookieStore = await cookies();
  const orgId = cookieStore.get("smbai-org-id")?.value;
  if (!orgId) throw new Error("No org");

  const supabase = await createClient();
  const [{ data: org }, { data: msgs }, { data: client }] = await Promise.all([
    supabase.from("organizations").select("name").eq("id", orgId).single(),
    supabase
      .from("messages")
      .select("direction, body, sent_at")
      .eq("organization_id", orgId)
      .eq("client_id", clientId)
      .order("sent_at", { ascending: false })
      .limit(8),
    supabase.from("clients").select("first_name, last_name").eq("id", clientId).eq("organization_id", orgId).single(),
  ]);

  const orgName = org?.name ?? "our business";
  const clientName = client
    ? [client.first_name, client.last_name].filter(Boolean).join(" ") || "the customer"
    : "the customer";

  const recent = (msgs ?? []).slice().reverse(); // chronological
  if (!recent.length) throw new Error("No conversation to reply to");

  const transcript = recent
    .map((m) => `${m.direction === "inbound" ? clientName : orgName}: ${m.body}`)
    .join("\n");

  const lengthRule =
    channel === "sms"
      ? "Keep it under 320 characters — concise and friendly, suitable for a text message."
      : "Keep it to a short, professional paragraph or two.";

  const prompt = `You are replying on behalf of the business "${orgName}" to a ${channel === "sms" ? "text message" : "email"} from a customer (${clientName}).

Conversation so far (most recent last):
${transcript}

Write the next reply FROM ${orgName}.
- ${lengthRule}
- Helpful, warm, and professional; address their latest message directly.
- Do NOT include a subject line, a greeting placeholder like "[Name]", or a signature block — just the message body.
- Return ONLY the reply text, no quotes or markdown.`;

  const response = await anthropic.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 500,
    messages: [{ role: "user", content: prompt }],
  });

  let text = (response.content[0] as { type: string; text: string }).text ?? "";
  text = text.trim();
  const fence = text.match(/```(?:\w+)?\s*([\s\S]*?)```/);
  if (fence) text = fence[1].trim();
  if (!text) throw new Error("Couldn't draft a reply — try again");
  return text;
}
