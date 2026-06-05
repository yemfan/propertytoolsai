/**
 * SMS Campaign Sender
 * Sends SMS campaigns to targeted recipients via Twilio
 */

import { createServiceClient } from "@/lib/supabase/server";
import twilio from "twilio";

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;

if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
  console.warn("[sms-campaign-sender] Twilio not configured");
}

const twilioClient = TWILIO_ACCOUNT_SID
  ? twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
  : null;

/**
 * Send an SMS campaign to targeted recipients
 * Returns count of sent messages
 */
export async function sendSMSCampaign(
  orgId: string,
  campaignId: string
): Promise<{ ok: boolean; sent: number; failed: number; error?: string }> {
  if (!twilioClient) {
    return { ok: false, sent: 0, failed: 0, error: "Twilio not configured" };
  }

  const supabase = await createServiceClient();

  try {
    // Get campaign details
    const { data: campaign } = await supabase
      .from("sms_campaigns")
      .select("*")
      .eq("id", campaignId)
      .eq("organization_id", orgId)
      .single();

    if (!campaign) {
      return { ok: false, sent: 0, failed: 0, error: "Campaign not found" };
    }

    // Get recipients based on targeting rules
    const recipients = await getTargetedRecipients(orgId, campaign);

    if (recipients.length === 0) {
      return { ok: false, sent: 0, failed: 0, error: "No recipients matched the targeting criteria" };
    }

    // Send messages
    let sent = 0;
    let failed = 0;
    const recipientIds: string[] = [];

    for (const recipient of recipients) {
      try {
        // Send via Twilio
        const message = await twilioClient.messages.create({
          from: TWILIO_PHONE_NUMBER!,
          to: recipient.phone_number,
          body: campaign.message_text,
        });

        // Record in database
        const { data: record } = await supabase
          .from("sms_campaign_recipients")
          .insert({
            campaign_id: campaignId,
            organization_id: orgId,
            client_id: recipient.client_id,
            phone_number: recipient.phone_number,
            recipient_name: recipient.recipient_name,
            recipient_email: recipient.recipient_email,
            twilio_sid: message.sid,
            sent_at: new Date().toISOString(),
          })
          .select("id")
          .single();

        if (record) {
          recipientIds.push(record.id);
          sent++;
        }
      } catch (err) {
        console.error("[sms-campaign-sender] message send error:", err);
        failed++;
      }
    }

    // Update campaign stats
    await supabase
      .from("sms_campaigns")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        total_recipients: recipients.length,
        delivered_count: sent,
        failed_count: failed,
      })
      .eq("id", campaignId);

    return { ok: true, sent, failed };
  } catch (err) {
    console.error("[sms-campaign-sender] error:", err);
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, sent: 0, failed: 0, error: msg };
  }
}

/**
 * Get targeted recipients based on campaign targeting rules
 */
async function getTargetedRecipients(
  orgId: string,
  campaign: any
): Promise<
  Array<{
    client_id: string;
    phone_number: string;
    recipient_name?: string;
    recipient_email?: string;
  }>
> {
  const supabase = await createServiceClient();

  // Get unsubscribed numbers
  const { data: unsubscribed } = await supabase
    .from("sms_unsubscribes")
    .select("phone_number")
    .eq("organization_id", orgId);

  const unsubscribedNumbers = new Set(unsubscribed?.map((u) => u.phone_number) ?? []);

  // Build query
  let query = supabase
    .from("clients")
    .select("id, first_name, last_name, email, phone")
    .eq("organization_id", orgId)
    .not("phone", "is", null);

  // Apply segment filtering
  if (campaign.target_segment === "leads") {
    query = query.eq("pipeline_stage", "lead");
  } else if (campaign.target_segment === "prospects") {
    query = query.eq("pipeline_stage", "prospect");
  } else if (campaign.target_segment === "active") {
    query = query.eq("status", "active");
  } else if (campaign.target_segment === "won") {
    query = query.eq("pipeline_stage", "won");
  } else if (campaign.target_segment === "custom" && campaign.target_pipeline_stages?.length) {
    query = query.in("pipeline_stage", campaign.target_pipeline_stages);
  }

  const { data: clients } = await query;

  if (!clients) return [];

  // Filter by tags if provided
  let filtered = clients;
  if (campaign.target_tags?.length > 0) {
    // Tag filtering would need a junction table; for now include all
    // TODO: implement tags support
  }

  // Exclude by tags
  if (campaign.exclude_tags?.length > 0) {
    // Exclude logic
    // TODO: implement tags support
  }

  // Remove unsubscribed
  filtered = filtered.filter((c) => !unsubscribedNumbers.has(c.phone));

  // Map to recipient format
  return filtered.map((c) => ({
    client_id: c.id,
    phone_number: c.phone,
    recipient_name: [c.first_name, c.last_name].filter(Boolean).join(" "),
    recipient_email: c.email,
  }));
}
