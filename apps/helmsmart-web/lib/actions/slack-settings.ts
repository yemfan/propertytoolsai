"use server";

import { cookies } from "next/headers";
import { createServiceClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { notifySlack } from "@/lib/integrations/slack";

/**
 * Save Slack webhook URL for the current org
 */
export async function saveSlackWebhook(
  webhookUrl: string
): Promise<{ ok: boolean; error?: string }> {
  const cookieStore = await cookies();
  const orgId = cookieStore.get("helmsmart-org-id")?.value;
  if (!orgId) return { ok: false, error: "Not authenticated" };

  // Basic URL validation
  if (webhookUrl && !webhookUrl.startsWith("https://hooks.slack.com/")) {
    return { ok: false, error: "Must be a valid Slack incoming webhook URL (hooks.slack.com)" };
  }

  const db = await createServiceClient();
  const { error } = await db
    .from("organizations")
    .update({ slack_webhook_url: webhookUrl || null })
    .eq("id", orgId);

  if (error) {
    console.error("[slack-settings] save error:", error);
    return { ok: false, error: error.message };
  }

  revalidatePath("/settings");
  return { ok: true };
}

/**
 * Update individual Slack notification toggle
 */
export async function saveSlackNotifyToggle(
  field:
    | "slack_notify_new_lead"
    | "slack_notify_approval"
    | "slack_notify_missed_call"
    | "slack_notify_form_submission",
  value: boolean
): Promise<{ ok: boolean }> {
  const cookieStore = await cookies();
  const orgId = cookieStore.get("helmsmart-org-id")?.value;
  if (!orgId) return { ok: false };

  const db = await createServiceClient();
  await db
    .from("organizations")
    .update({ [field]: value })
    .eq("id", orgId);

  revalidatePath("/settings");
  return { ok: true };
}

/**
 * Send a test message to the configured Slack channel
 */
export async function testSlackWebhook(): Promise<{ ok: boolean; error?: string }> {
  const cookieStore = await cookies();
  const orgId = cookieStore.get("helmsmart-org-id")?.value;
  if (!orgId) return { ok: false, error: "Not authenticated" };

  const ok = await notifySlack(orgId, {
    text: "✅ HelmSmart Slack integration is working!",
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "✅ *HelmSmart is connected to Slack!*\nYou'll receive notifications here for new leads, missed calls, form submissions, and AI approvals.",
        },
      },
    ],
  });

  if (!ok) {
    return { ok: false, error: "Failed to send test message. Check your webhook URL." };
  }

  return { ok: true };
}
