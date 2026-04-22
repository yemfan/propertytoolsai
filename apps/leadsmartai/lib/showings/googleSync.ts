import "server-only";

import { deleteGoogleEvent, upsertGoogleEvent } from "@/lib/google-calendar/sync";
import type { ShowingRow } from "./types";

/**
 * Showing ↔ Google Calendar glue.
 *
 * All functions here are best-effort — they swallow errors + log. A
 * calendar-sync failure must NEVER cascade into failing the primary DB
 * write for the showing. Agents can always re-save a showing to retry,
 * or reconnect Google Calendar from Settings.
 *
 * End-time is derived from scheduled_at + duration_minutes. We default
 * duration to 30 minutes if it's null — most showings run 20-40m, and
 * 30 is a sane midpoint.
 */

const DEFAULT_DURATION_MIN = 30;

export async function syncShowingToGoogle(
  showing: Pick<
    ShowingRow,
    | "agent_id"
    | "google_event_id"
    | "property_address"
    | "city"
    | "state"
    | "zip"
    | "scheduled_at"
    | "duration_minutes"
    | "access_notes"
    | "listing_agent_name"
    | "listing_agent_email"
    | "listing_agent_phone"
    | "mls_url"
    | "notes"
  >,
  contactName: string | null,
): Promise<{ googleEventId: string | null }> {
  try {
    const endAt = computeEndIso(showing.scheduled_at, showing.duration_minutes);
    return await upsertGoogleEvent({
      agentId: showing.agent_id,
      existingGoogleEventId: showing.google_event_id ?? null,
      title: buildEventTitle(showing.property_address, contactName),
      description: buildEventDescription(showing, contactName),
      startAt: showing.scheduled_at,
      endAt,
      location: buildEventLocation(showing),
    });
  } catch (err) {
    console.error(
      "[showings.syncShowingToGoogle] swallowed:",
      err instanceof Error ? err.message : err,
    );
    return { googleEventId: showing.google_event_id ?? null };
  }
}

export async function deleteShowingFromGoogle(
  agentId: string,
  googleEventId: string | null,
): Promise<void> {
  if (!googleEventId) return;
  try {
    await deleteGoogleEvent({ agentId, googleEventId });
  } catch (err) {
    console.error(
      "[showings.deleteShowingFromGoogle] swallowed:",
      err instanceof Error ? err.message : err,
    );
  }
}

/**
 * Fields that, when changed, should trigger a re-sync to Google.
 * Status changes are handled separately (cancelled → delete event).
 * Excludes metadata fields like `notes` — those update the description,
 * but not urgently enough to hit Google on every note tweak. If the
 * agent hits "Sync to calendar" manually in the future we'd re-sync.
 */
export function needsResync(
  before: Pick<
    ShowingRow,
    "scheduled_at" | "duration_minutes" | "property_address" | "city" | "state" | "zip"
  >,
  after: Partial<ShowingRow>,
): boolean {
  if (after.scheduled_at !== undefined && after.scheduled_at !== before.scheduled_at) return true;
  if (
    after.duration_minutes !== undefined &&
    after.duration_minutes !== before.duration_minutes
  )
    return true;
  if (after.property_address !== undefined && after.property_address !== before.property_address)
    return true;
  if (after.city !== undefined && after.city !== before.city) return true;
  if (after.state !== undefined && after.state !== before.state) return true;
  if (after.zip !== undefined && after.zip !== before.zip) return true;
  return false;
}

// ── Pure helpers (exported for unit-testing) ──────────────────────────

export function computeEndIso(startIso: string, durationMinutes: number | null): string {
  const start = new Date(startIso).getTime();
  const mins = durationMinutes && durationMinutes > 0 ? durationMinutes : DEFAULT_DURATION_MIN;
  return new Date(start + mins * 60_000).toISOString();
}

export function buildEventTitle(propertyAddress: string, contactName: string | null): string {
  return contactName
    ? `Showing: ${propertyAddress} (with ${contactName})`
    : `Showing: ${propertyAddress}`;
}

export function buildEventLocation(
  s: Pick<ShowingRow, "property_address" | "city" | "state" | "zip">,
): string {
  return [s.property_address, [s.city, s.state].filter(Boolean).join(", "), s.zip]
    .filter(Boolean)
    .join(" ")
    .trim();
}

export function buildEventDescription(
  s: Pick<
    ShowingRow,
    "access_notes" | "listing_agent_name" | "listing_agent_email" | "listing_agent_phone" | "mls_url" | "notes"
  >,
  contactName: string | null,
): string {
  const lines: string[] = [];
  if (contactName) lines.push(`Buyer: ${contactName}`);
  if (s.listing_agent_name || s.listing_agent_email || s.listing_agent_phone) {
    const parts = [s.listing_agent_name, s.listing_agent_email, s.listing_agent_phone].filter(
      Boolean,
    );
    lines.push(`Listing agent: ${parts.join(" · ")}`);
  }
  if (s.access_notes) lines.push(`Access: ${s.access_notes}`);
  if (s.mls_url) lines.push(`Listing: ${s.mls_url}`);
  if (s.notes) lines.push("", s.notes);
  return lines.join("\n");
}
