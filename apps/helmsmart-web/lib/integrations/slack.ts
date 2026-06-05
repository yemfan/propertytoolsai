/**
 * Slack integration — Incoming Webhooks
 * No OAuth needed; each org pastes a webhook URL from their Slack app.
 * https://api.slack.com/messaging/webhooks
 */

import { createServiceClient } from "@/lib/supabase/server";

interface SlackBlock {
  type: string;
  [key: string]: unknown;
}

interface SlackMessage {
  text: string; // fallback for notifications
  blocks?: SlackBlock[];
}

/**
 * Send a message to the org's Slack workspace.
 * Returns true on success, false if not configured or on error.
 * Never throws — Slack failures must not break core flows.
 */
export async function notifySlack(
  orgId: string,
  message: SlackMessage
): Promise<boolean> {
  try {
    const db = await createServiceClient();
    const { data: org } = await db
      .from("organizations")
      .select("slack_webhook_url, name")
      .eq("id", orgId)
      .maybeSingle();

    if (!org?.slack_webhook_url) return false;

    const res = await fetch(org.slack_webhook_url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message),
    });

    return res.ok;
  } catch (e) {
    console.error("[slack] notify error:", e);
    return false;
  }
}

/**
 * Send a Slack notification for a new form submission.
 */
export async function notifySlackFormSubmission(
  orgId: string,
  opts: {
    formTitle: string;
    name?: string;
    email?: string;
    phone?: string;
    submissionsUrl: string;
    clientUrl?: string;
  }
): Promise<void> {
  const db = await createServiceClient();
  const { data: org } = await db
    .from("organizations")
    .select("slack_webhook_url, slack_notify_form_submission")
    .eq("id", orgId)
    .maybeSingle();

  if (!org?.slack_webhook_url || org.slack_notify_form_submission === false) return;

  const who = opts.name || opts.email || opts.phone || "Someone";
  const contact = [opts.email, opts.phone].filter(Boolean).join(" · ");

  await notifySlack(orgId, {
    text: `📋 New form submission: ${opts.formTitle} from ${who}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*📋 New form submission*\n*Form:* ${opts.formTitle}`,
        },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Name:*\n${opts.name || "—"}` },
          { type: "mrkdwn", text: `*Contact:*\n${contact || "—"}` },
        ],
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "View submissions" },
            url: opts.submissionsUrl,
            style: "primary",
          },
          ...(opts.clientUrl
            ? [{
                type: "button",
                text: { type: "plain_text", text: "View in CRM" },
                url: opts.clientUrl,
              }]
            : []),
        ],
      },
    ],
  });
}

/**
 * Send a Slack notification for a new lead (client) created.
 */
export async function notifySlackNewLead(
  orgId: string,
  opts: {
    name: string;
    email?: string;
    phone?: string;
    source?: string;
    clientUrl: string;
  }
): Promise<void> {
  const db = await createServiceClient();
  const { data: org } = await db
    .from("organizations")
    .select("slack_webhook_url, slack_notify_new_lead")
    .eq("id", orgId)
    .maybeSingle();

  if (!org?.slack_webhook_url || org.slack_notify_new_lead === false) return;

  const contact = [opts.email, opts.phone].filter(Boolean).join(" · ");

  await notifySlack(orgId, {
    text: `🙋 New lead: ${opts.name}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*🙋 New lead added*\n*Name:* ${opts.name}`,
        },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Contact:*\n${contact || "—"}` },
          { type: "mrkdwn", text: `*Source:*\n${opts.source || "manual"}` },
        ],
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "View in CRM" },
            url: opts.clientUrl,
            style: "primary",
          },
        ],
      },
    ],
  });
}

/**
 * Send a Slack notification for a missed call.
 */
export async function notifySlackMissedCall(
  orgId: string,
  opts: {
    callerNumber: string;
    autoTexted: boolean;
    voiceUrl: string;
  }
): Promise<void> {
  const db = await createServiceClient();
  const { data: org } = await db
    .from("organizations")
    .select("slack_webhook_url, slack_notify_missed_call")
    .eq("id", orgId)
    .maybeSingle();

  if (!org?.slack_webhook_url || org.slack_notify_missed_call === false) return;

  const autoTextNote = opts.autoTexted ? " · auto-texted ✅" : " · no auto-text sent";

  await notifySlack(orgId, {
    text: `📞 Missed call from ${opts.callerNumber}${autoTextNote}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*📞 Missed call*\nFrom *${opts.callerNumber}*${autoTextNote}`,
        },
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "View in Reception" },
            url: opts.voiceUrl,
          },
        ],
      },
    ],
  });
}

/**
 * Send a Slack notification for a pending AI approval.
 */
export async function notifySlackApprovalPending(
  orgId: string,
  opts: {
    employeeName: string;
    description: string;
    approvalsUrl: string;
  }
): Promise<void> {
  const db = await createServiceClient();
  const { data: org } = await db
    .from("organizations")
    .select("slack_webhook_url, slack_notify_approval")
    .eq("id", orgId)
    .maybeSingle();

  if (!org?.slack_webhook_url || org.slack_notify_approval === false) return;

  await notifySlack(orgId, {
    text: `🤖 ${opts.employeeName} needs approval: ${opts.description}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*🤖 AI approval needed*\n*${opts.employeeName}* wants to: ${opts.description}`,
        },
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "Review & Approve" },
            url: opts.approvalsUrl,
            style: "primary",
          },
        ],
      },
    ],
  });
}
