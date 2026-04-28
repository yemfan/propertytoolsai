/**
 * Pure aggregation helpers for email-tracking. Given a list of
 * EmailEvent rows, compute the stats card numbers (sent / opened /
 * clicked + open and click-through rates).
 *
 * Lives in its own file so vitest can hit it without Supabase.
 */

import type { EmailEvent, EmailStats } from "./types";

export function computeEmailStats(
  events: ReadonlyArray<EmailEvent>,
): EmailStats {
  let sent = 0;
  let delivered = 0;
  let opened = 0;
  let clicked = 0;
  let bounced = 0;

  // Resend can send multiple `opened` events for one email (the user
  // opens it twice). We dedupe by email_id for opened/clicked so the
  // open-rate denominator (delivered) and numerator (opened) line up
  // — otherwise a single multi-open email skews the rate above 100%.
  const openedIds = new Set<string>();
  const clickedIds = new Set<string>();

  for (const e of events) {
    switch (e.eventType) {
      case "sent":
        sent++;
        break;
      case "delivered":
        delivered++;
        break;
      case "opened":
        if (!openedIds.has(e.externalMessageId)) {
          openedIds.add(e.externalMessageId);
          opened++;
        }
        break;
      case "clicked":
        if (!clickedIds.has(e.externalMessageId)) {
          clickedIds.add(e.externalMessageId);
          clicked++;
        }
        break;
      case "bounced":
        bounced++;
        break;
      default:
        break;
    }
  }

  const openRate = delivered > 0 ? opened / delivered : 0;
  const clickThroughRate = opened > 0 ? clicked / opened : 0;

  return { sent, delivered, opened, clicked, bounced, openRate, clickThroughRate };
}
