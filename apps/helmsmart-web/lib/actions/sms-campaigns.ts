"use server";

import { cookies } from "next/headers";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { sendSMSCampaign } from "@/lib/integrations/sms-campaign-sender";

export interface CreateCampaignInput {
  name: string;
  messageText: string;
  targetSegment: "all" | "leads" | "prospects" | "active" | "won" | "custom";
  targetPipelineStages?: string[];
  targetTags?: string[];
  excludeTags?: string[];
  scheduledFor?: string; // ISO timestamp
  description?: string;
}

/**
 * Create a new SMS campaign
 */
export async function createSMSCampaign(
  input: CreateCampaignInput
): Promise<{ ok: boolean; campaignId?: string; error?: string }> {
  const cookieStore = await cookies();
  const orgId = cookieStore.get("helmsmart-org-id")?.value;
  if (!orgId) return { ok: false, error: "Not authenticated" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No user session" };

  const db = await createServiceClient();

  // Validate message length (SMS is ~160 chars, but allow more for proper splitting)
  if (input.messageText.length > 1000) {
    return { ok: false, error: "Message too long (max 1000 characters)" };
  }

  const { data: campaign, error } = await db
    .from("sms_campaigns")
    .insert({
      organization_id: orgId,
      name: input.name,
      description: input.description,
      message_text: input.messageText,
      target_segment: input.targetSegment,
      target_pipeline_stages: input.targetPipelineStages || [],
      target_tags: input.targetTags || [],
      exclude_tags: input.excludeTags || [],
      scheduled_for: input.scheduledFor || null,
      created_by: user.id,
      status: input.scheduledFor ? "scheduled" : "draft",
    })
    .select("id")
    .single();

  if (error || !campaign) {
    console.error("[sms-campaigns] create error:", error);
    return { ok: false, error: error?.message || "Failed to create campaign" };
  }

  revalidatePath("/marketing/sms");
  return { ok: true, campaignId: campaign.id };
}

/**
 * Get list of campaigns for an organization
 */
export async function listSMSCampaigns(limit = 50) {
  const cookieStore = await cookies();
  const orgId = cookieStore.get("helmsmart-org-id")?.value;
  if (!orgId) return [];

  const supabase = await createClient();

  const { data: campaigns } = await supabase
    .from("sms_campaigns")
    .select(
      `id, name, message_text, target_segment, status,
       total_recipients, delivered_count, failed_count, click_count,
       scheduled_for, sent_at, created_at`
    )
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return campaigns ?? [];
}

/**
 * Get campaign details including recipient stats
 */
export async function getSMSCampaign(campaignId: string) {
  const cookieStore = await cookies();
  const orgId = cookieStore.get("helmsmart-org-id")?.value;
  if (!orgId) return null;

  const supabase = await createClient();

  const { data: campaign } = await supabase
    .from("sms_campaigns")
    .select(`
      id, name, message_text, target_segment, status,
      total_recipients, delivered_count, failed_count, unsubscribe_count, click_count,
      scheduled_for, sent_at, created_at, created_by
    `)
    .eq("organization_id", orgId)
    .eq("id", campaignId)
    .single();

  return campaign;
}

/**
 * Send an SMS campaign immediately or at scheduled time
 */
export async function sendSMSCampaignNow(campaignId: string): Promise<{ ok: boolean; error?: string }> {
  const cookieStore = await cookies();
  const orgId = cookieStore.get("helmsmart-org-id")?.value;
  if (!orgId) return { ok: false, error: "Not authenticated" };

  const supabase = await createClient();

  // Get campaign
  const { data: campaign } = await supabase
    .from("sms_campaigns")
    .select("*")
    .eq("organization_id", orgId)
    .eq("id", campaignId)
    .single();

  if (!campaign) return { ok: false, error: "Campaign not found" };
  if (campaign.status !== "draft" && campaign.status !== "scheduled") {
    return { ok: false, error: `Cannot send campaign with status: ${campaign.status}` };
  }

  // Send campaign
  const result = await sendSMSCampaign(orgId, campaignId);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  revalidatePath("/marketing/sms");
  return { ok: true };
}

/**
 * Delete an SMS campaign (only if draft)
 */
export async function deleteSMSCampaign(campaignId: string): Promise<{ ok: boolean; error?: string }> {
  const cookieStore = await cookies();
  const orgId = cookieStore.get("helmsmart-org-id")?.value;
  if (!orgId) return { ok: false, error: "Not authenticated" };

  const supabase = await createClient();

  // Check status
  const { data: campaign } = await supabase
    .from("sms_campaigns")
    .select("status")
    .eq("organization_id", orgId)
    .eq("id", campaignId)
    .single();

  if (!campaign) return { ok: false, error: "Campaign not found" };
  if (campaign.status !== "draft") {
    return { ok: false, error: "Can only delete draft campaigns" };
  }

  const db = await createServiceClient();
  const { error } = await db
    .from("sms_campaigns")
    .delete()
    .eq("id", campaignId)
    .eq("organization_id", orgId);

  if (error) {
    console.error("[sms-campaigns] delete error:", error);
    return { ok: false, error: error.message };
  }

  revalidatePath("/marketing/sms");
  return { ok: true };
}

/**
 * Update an existing draft campaign
 */
export async function updateSMSCampaign(
  campaignId: string,
  input: Partial<CreateCampaignInput>
): Promise<{ ok: boolean; error?: string }> {
  const cookieStore = await cookies();
  const orgId = cookieStore.get("helmsmart-org-id")?.value;
  if (!orgId) return { ok: false, error: "Not authenticated" };

  const db = await createServiceClient();

  // Check campaign exists and is editable
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("sms_campaigns")
    .select("status")
    .eq("id", campaignId)
    .eq("organization_id", orgId)
    .single();

  if (!existing) return { ok: false, error: "Campaign not found" };
  if (existing.status !== "draft" && existing.status !== "scheduled") {
    return { ok: false, error: "Cannot edit a sent campaign" };
  }

  const updates: Record<string, unknown> = {};
  if (input.name !== undefined) updates.name = input.name;
  if (input.description !== undefined) updates.description = input.description;
  if (input.messageText !== undefined) updates.message_text = input.messageText;
  if (input.targetSegment !== undefined) updates.target_segment = input.targetSegment;
  if (input.targetPipelineStages !== undefined) updates.target_pipeline_stages = input.targetPipelineStages;
  if (input.targetTags !== undefined) updates.target_tags = input.targetTags;
  if (input.excludeTags !== undefined) updates.exclude_tags = input.excludeTags;
  if (input.scheduledFor !== undefined) {
    updates.scheduled_for = input.scheduledFor || null;
    updates.status = input.scheduledFor ? "scheduled" : "draft";
  }

  const { error } = await db
    .from("sms_campaigns")
    .update(updates)
    .eq("id", campaignId)
    .eq("organization_id", orgId);

  if (error) {
    console.error("[sms-campaigns] update error:", error);
    return { ok: false, error: error.message };
  }

  revalidatePath("/marketing/sms");
  revalidatePath(`/marketing/sms/${campaignId}`);
  return { ok: true };
}

/**
 * Unsubscribe a phone number from SMS campaigns
 */
export async function unsubscribeFromSMS(phoneNumber: string): Promise<{ ok: boolean }> {
  const cookieStore = await cookies();
  const orgId = cookieStore.get("helmsmart-org-id")?.value;
  if (!orgId) return { ok: false };

  const db = await createServiceClient();

  await db.from("sms_unsubscribes").upsert(
    {
      organization_id: orgId,
      phone_number: phoneNumber,
      reason: "manual",
    },
    { onConflict: "organization_id,phone_number" }
  );

  return { ok: true };
}
