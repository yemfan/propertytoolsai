/**
 * Pure mapping from Resend's webhook payload to our internal
 * EmailEvent shape. Lives in its own file (no `server-only`) so
 * vitest hits it without spinning up Supabase.
 *
 * Resend webhook reference:
 *   {
 *     type: "email.delivered" | "email.opened" | "email.clicked" | …,
 *     created_at: "2026-04-28T...",
 *     data: {
 *       email_id: "...",
 *       to: ["..."],
 *       subject: "...",
 *       click?: { link: "https://..." }   // only on email.clicked
 *     }
 *   }
 *
 * Anything we don't recognise returns `null` — the webhook handler
 * skips inserting and 200's so Resend doesn't retry forever.
 */

import type { EmailEventType } from "./types";

export type ResendWebhookPayload = {
  type?: string;
  created_at?: string;
  data?: {
    email_id?: string;
    click?: { link?: string };
    [key: string]: unknown;
  };
};

export type ParsedEmailEvent = {
  externalMessageId: string;
  eventType: EmailEventType;
  url: string | null;
  occurredAt: string;
  metadata: Record<string, unknown>;
};

const TYPE_MAP: Record<string, EmailEventType> = {
  "email.sent": "sent",
  "email.delivered": "delivered",
  "email.delivery_delayed": "delayed",
  "email.opened": "opened",
  "email.clicked": "clicked",
  "email.bounced": "bounced",
  "email.complained": "complained",
};

export function parseResendEvent(
  payload: ResendWebhookPayload,
): ParsedEmailEvent | null {
  const type = payload.type;
  if (!type) return null;
  const eventType = TYPE_MAP[type];
  if (!eventType) return null;

  const data = payload.data ?? {};
  const externalMessageId = typeof data.email_id === "string" ? data.email_id : "";
  if (!externalMessageId) return null;

  const occurredAt = typeof payload.created_at === "string" && payload.created_at
    ? payload.created_at
    : new Date().toISOString();

  const url =
    eventType === "clicked" && typeof data.click?.link === "string"
      ? data.click.link
      : null;

  // Strip the email_id + click sub-object from metadata since they're
  // already first-class columns. Keep everything else (subject,
  // recipient, IP, user agent on opens, etc.) for forensic value.
  const metadata: Record<string, unknown> = { ...data };
  delete metadata.email_id;
  delete metadata.click;

  return {
    externalMessageId,
    eventType,
    url,
    occurredAt,
    metadata,
  };
}
