/**
 * Shared types for the email-tracking layer.
 *
 * `EmailEventType` mirrors Resend's webhook event names with the
 * `email.` prefix stripped. The DB CHECK constraint on
 * email_events.event_type uses the same values.
 */

export type EmailEventType =
  | "sent"
  | "delivered"
  | "delayed"
  | "opened"
  | "clicked"
  | "bounced"
  | "complained";

export type EmailEvent = {
  id: string;
  externalMessageId: string;
  eventId: string | null;
  agentId: string | null;
  leadId: number | null;
  eventType: EmailEventType;
  url: string | null;
  metadata: Record<string, unknown>;
  occurredAt: string;
  createdAt: string;
};

/**
 * Aggregate counts over a window of events. The dashboard renders
 * sent / opened / clicked + the two derived rates, so we precompute
 * everything in one pass.
 */
export type EmailStats = {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  /** opened / delivered. 0 when delivered is 0. */
  openRate: number;
  /** clicked / opened. 0 when opened is 0. Different denom by design —
   *  click rate against opens is the "did the open lead anywhere"
   *  signal, which is the question the agent actually asks. */
  clickThroughRate: number;
};
