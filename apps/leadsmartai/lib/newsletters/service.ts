import "server-only";

import { sendEmail } from "@/lib/email";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  expandHtmlTemplate,
  expandTextTemplate,
  type TemplateTokens,
} from "./templating";
import { validateForSend } from "./validation";

/**
 * Server-side service for newsletter campaigns.
 *
 * Flow:
 *   1. createCampaign — insert a draft
 *   2. addRecipients(campaignId, [{email, firstName, ...}, ...])
 *      OR addRecipientsFromContacts(campaignId, contactIds[])
 *   3. sendCampaign(campaignId) — validates + fans out one
 *      Resend send per recipient, expanding tokens per-recipient
 *
 * Send is sequential within a single invocation. For pilot-sized
 * lists (<1k) this is fine; a future PR can move fanout into a
 * background queue if needed.
 */

export type Newsletter = {
  id: string;
  agentId: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  fromName: string | null;
  replyToEmail: string | null;
  status: "draft" | "queued" | "sending" | "sent" | "failed" | "canceled";
  scheduledAt: string | null;
  sentStartedAt: string | null;
  sentCompletedAt: string | null;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  createdAt: string;
  updatedAt: string;
};

export type RecipientInput = {
  contactId?: string | null;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
};

export async function createCampaign(args: {
  agentId: string;
  subject?: string;
  bodyHtml?: string;
  bodyText?: string;
  fromName?: string | null;
  replyToEmail?: string | null;
}): Promise<Newsletter> {
  const { data, error } = await supabaseAdmin
    .from("newsletters")
    .insert({
      agent_id: args.agentId,
      subject: args.subject ?? "",
      body_html: args.bodyHtml ?? "",
      body_text: args.bodyText ?? "",
      from_name: args.fromName ?? null,
      reply_to_email: args.replyToEmail ?? null,
      status: "draft",
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Failed to create campaign");
  return mapRow(data as Record<string, unknown>);
}

export async function listForAgent(agentId: string): Promise<Newsletter[]> {
  const { data } = await supabaseAdmin
    .from("newsletters")
    .select("*")
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false });
  return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
}

export async function getCampaign(id: string): Promise<Newsletter | null> {
  const { data } = await supabaseAdmin
    .from("newsletters")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return data ? mapRow(data as Record<string, unknown>) : null;
}

export async function updateCampaign(args: {
  id: string;
  subject?: string;
  bodyHtml?: string;
  bodyText?: string;
  fromName?: string | null;
  replyToEmail?: string | null;
}): Promise<Newsletter | null> {
  const patch: Record<string, unknown> = {};
  if (args.subject !== undefined) patch.subject = args.subject;
  if (args.bodyHtml !== undefined) patch.body_html = args.bodyHtml;
  if (args.bodyText !== undefined) patch.body_text = args.bodyText;
  if (args.fromName !== undefined) patch.from_name = args.fromName;
  if (args.replyToEmail !== undefined) patch.reply_to_email = args.replyToEmail;
  const { data } = await supabaseAdmin
    .from("newsletters")
    .update(patch)
    .eq("id", args.id)
    .select("*")
    .single();
  return data ? mapRow(data as Record<string, unknown>) : null;
}

/**
 * Bulk-add recipients. Idempotent on `(newsletter_id, email)` —
 * re-adding the same email refreshes the row's name fields. Skips
 * blank emails defensively. Updates `recipient_count` on the
 * campaign.
 */
export async function addRecipients(
  campaignId: string,
  recipients: ReadonlyArray<RecipientInput>,
): Promise<{ added: number }> {
  const rows = recipients
    .filter((r) => r.email && r.email.includes("@"))
    .map((r) => ({
      newsletter_id: campaignId,
      contact_id: r.contactId ?? null,
      email: r.email.trim().toLowerCase(),
      first_name: r.firstName ?? null,
      last_name: r.lastName ?? null,
      status: "pending",
    }));
  if (rows.length === 0) return { added: 0 };

  const { error } = await supabaseAdmin
    .from("newsletter_recipients")
    .upsert(rows, { onConflict: "newsletter_id,email" });
  if (error) throw new Error(error.message);

  // Recompute count.
  const { count } = await supabaseAdmin
    .from("newsletter_recipients")
    .select("id", { count: "exact", head: true })
    .eq("newsletter_id", campaignId);
  await supabaseAdmin
    .from("newsletters")
    .update({ recipient_count: count ?? 0 })
    .eq("id", campaignId);

  return { added: rows.length };
}

/**
 * Pull recipients from the agent's contacts table by id. Convenient
 * when the compose UI lets the agent pick a smart list.
 */
export async function addRecipientsFromContacts(
  campaignId: string,
  contactIds: ReadonlyArray<string>,
): Promise<{ added: number }> {
  if (contactIds.length === 0) return { added: 0 };
  const { data } = await supabaseAdmin
    .from("contacts")
    .select("id, email, first_name, last_name")
    .in("id", contactIds as string[])
    .not("email", "is", null);
  const recipients: RecipientInput[] = (data ?? []).map((r) => {
    const row = r as {
      id: string;
      email: string | null;
      first_name: string | null;
      last_name: string | null;
    };
    return {
      contactId: row.id,
      email: row.email ?? "",
      firstName: row.first_name,
      lastName: row.last_name,
    };
  });
  return addRecipients(campaignId, recipients);
}

/**
 * Fan-out the campaign. Sequential per-recipient sends. On each
 * recipient: expand templates with their own tokens, hand to
 * sendEmail, persist status. On error per recipient: mark that
 * row failed, continue. On systemic failure: mark the campaign
 * itself failed.
 *
 * Caller-supplied `unsubscribeUrlForEmail` is invoked per recipient
 * so the URL embeds a per-recipient opt-out token. Returns a
 * summary of send counts.
 */
export async function sendCampaign(args: {
  campaignId: string;
  agentName?: string | null;
  unsubscribeUrlForEmail: (email: string) => string;
}): Promise<{ sent: number; failed: number; skipped: number }> {
  const campaign = await getCampaign(args.campaignId);
  if (!campaign) throw new Error("Campaign not found");
  if (campaign.status === "sending" || campaign.status === "sent") {
    throw new Error("Campaign already sent or sending");
  }

  const verdict = validateForSend({
    subject: campaign.subject,
    bodyHtml: campaign.bodyHtml,
    bodyText: campaign.bodyText,
    recipientCount: campaign.recipientCount,
  });
  if (!verdict.ok) {
    throw new Error(`Campaign not valid for send: ${verdict.issues.join(", ")}`);
  }

  await supabaseAdmin
    .from("newsletters")
    .update({ status: "sending", sent_started_at: new Date().toISOString() })
    .eq("id", args.campaignId);

  const { data: recipientRows } = await supabaseAdmin
    .from("newsletter_recipients")
    .select("id, email, first_name, last_name")
    .eq("newsletter_id", args.campaignId)
    .eq("status", "pending");

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const r of (recipientRows ?? []) as Array<{
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
  }>) {
    const tokens: TemplateTokens = {
      firstName: r.first_name,
      lastName: r.last_name,
      email: r.email,
      agentName: args.agentName ?? null,
      unsubscribeUrl: args.unsubscribeUrlForEmail(r.email),
    };
    const subject = expandTextTemplate(campaign.subject, tokens);
    const text = expandTextTemplate(campaign.bodyText, tokens);
    const html = expandHtmlTemplate(campaign.bodyHtml, tokens);

    try {
      const result = await sendEmail({
        to: r.email,
        subject,
        text,
        html: html || undefined,
      });
      const externalMessageId = result?.id ? String(result.id) : null;
      await supabaseAdmin
        .from("newsletter_recipients")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          external_message_id: externalMessageId,
        })
        .eq("id", r.id);
      sent++;
    } catch (e) {
      await supabaseAdmin
        .from("newsletter_recipients")
        .update({ status: "failed", error_message: (e as Error).message })
        .eq("id", r.id);
      failed++;
    }
  }

  await supabaseAdmin
    .from("newsletters")
    .update({
      status: failed > 0 && sent === 0 ? "failed" : "sent",
      sent_completed_at: new Date().toISOString(),
      sent_count: sent,
      failed_count: failed,
    })
    .eq("id", args.campaignId);

  return { sent, failed, skipped };
}

// ── row mapper ──────────────────────────────────────────────────

function mapRow(row: Record<string, unknown>): Newsletter {
  return {
    id: String(row.id ?? ""),
    agentId: String(row.agent_id ?? ""),
    subject: String(row.subject ?? ""),
    bodyHtml: String(row.body_html ?? ""),
    bodyText: String(row.body_text ?? ""),
    fromName: (row.from_name as string | null) ?? null,
    replyToEmail: (row.reply_to_email as string | null) ?? null,
    status: (row.status as Newsletter["status"]) ?? "draft",
    scheduledAt: (row.scheduled_at as string | null) ?? null,
    sentStartedAt: (row.sent_started_at as string | null) ?? null,
    sentCompletedAt: (row.sent_completed_at as string | null) ?? null,
    recipientCount: Number(row.recipient_count ?? 0),
    sentCount: Number(row.sent_count ?? 0),
    failedCount: Number(row.failed_count ?? 0),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}
