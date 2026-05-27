"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { Resend } from "resend";
import twilio from "twilio";

const resend = new Resend(process.env.RESEND_API_KEY);

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
