import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  deleteShowingFromGoogle,
  needsResync,
  syncShowingToGoogle,
} from "./googleSync";
import type {
  ContactShowingStats,
  OverallReaction,
  ShowingFeedbackRow,
  ShowingListItem,
  ShowingRow,
  ShowingStatus,
} from "./types";

/**
 * Service layer for buyer-side showings.
 *
 * All writes use `supabaseAdmin` (service role) so they bypass RLS — API
 * routes enforce agent ownership at the auth layer (`agent_id` match).
 *
 * Feedback upsert semantics:
 *   showing_feedback has a unique(showing_id) so a single showing has at
 *   most one feedback row. Re-submitting replaces prior values. Multi-
 *   visit feedback is a scope cut; if we need it later, drop the
 *   constraint and key by (showing_id, created_at) instead.
 */

// ── CREATE ────────────────────────────────────────────────────────────

export type CreateShowingInput = {
  agentId: string;
  contactId: string;
  propertyAddress: string;
  scheduledAt: string; // ISO timestamptz
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  mlsNumber?: string | null;
  mlsUrl?: string | null;
  durationMinutes?: number | null;
  accessNotes?: string | null;
  listingAgentName?: string | null;
  listingAgentEmail?: string | null;
  listingAgentPhone?: string | null;
  notes?: string | null;
};

export async function createShowing(input: CreateShowingInput): Promise<ShowingRow> {
  const { data, error } = await supabaseAdmin
    .from("showings")
    .insert({
      agent_id: input.agentId,
      contact_id: input.contactId,
      property_address: input.propertyAddress,
      city: input.city ?? null,
      state: input.state ?? null,
      zip: input.zip ?? null,
      mls_number: input.mlsNumber ?? null,
      mls_url: input.mlsUrl ?? null,
      scheduled_at: input.scheduledAt,
      duration_minutes: input.durationMinutes ?? 30,
      access_notes: input.accessNotes ?? null,
      listing_agent_name: input.listingAgentName ?? null,
      listing_agent_email: input.listingAgentEmail ?? null,
      listing_agent_phone: input.listingAgentPhone ?? null,
      notes: input.notes ?? null,
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Failed to create showing");
  const row = data as ShowingRow;

  // Fire-and-forget Google Calendar sync. If the agent hasn't connected
  // Google, upsertGoogleEvent returns null and we leave google_event_id
  // null — the showing is still valid, it just isn't on their calendar.
  const contactName = await fetchContactDisplayName(input.contactId);
  const { googleEventId } = await syncShowingToGoogle(row, contactName);
  if (googleEventId && googleEventId !== row.google_event_id) {
    await supabaseAdmin
      .from("showings")
      .update({ google_event_id: googleEventId })
      .eq("id", row.id);
    row.google_event_id = googleEventId;
  }

  return row;
}

// ── READ ──────────────────────────────────────────────────────────────

export async function listShowingsForAgent(
  agentId: string,
  opts?: { contactId?: string },
): Promise<ShowingListItem[]> {
  let query = supabaseAdmin
    .from("showings")
    .select("*, contacts!inner(id, name, first_name, last_name, email)")
    .eq("agent_id", agentId)
    .order("scheduled_at", { ascending: false });
  if (opts?.contactId) query = query.eq("contact_id", opts.contactId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) return [];

  const ids = (data as Array<{ id: string }>).map((r) => r.id);
  const { data: feedbackRows } = await supabaseAdmin
    .from("showing_feedback")
    .select("showing_id, rating, overall_reaction, would_offer")
    .in("showing_id", ids);

  type FeedbackSummary = {
    showing_id: string;
    rating: number | null;
    overall_reaction: OverallReaction | null;
    would_offer: boolean;
  };
  const byShowing = new Map<string, FeedbackSummary>();
  for (const f of (feedbackRows ?? []) as FeedbackSummary[]) {
    byShowing.set(f.showing_id, f);
  }

  return (
    data as Array<
      ShowingRow & {
        contacts: {
          id: string;
          name: string | null;
          first_name: string | null;
          last_name: string | null;
          email: string | null;
        } | null;
      }
    >
  ).map((row) => {
    const c = row.contacts;
    const contactName =
      (c?.first_name || c?.last_name
        ? `${c?.first_name ?? ""} ${c?.last_name ?? ""}`.trim()
        : c?.name) ?? c?.email ?? null;
    const f = byShowing.get(row.id);
    // Drop the nested contacts object before returning to match the flat
    // list-item shape.
    const { contacts: _c, ...rest } = row as ShowingRow & { contacts?: unknown };
    void _c;
    return {
      ...(rest as ShowingRow),
      contact_name: contactName,
      feedback_rating: f?.rating ?? null,
      feedback_reaction: f?.overall_reaction ?? null,
      feedback_would_offer: f?.would_offer ?? false,
    };
  });
}

export async function getShowingWithFeedback(
  agentId: string,
  id: string,
): Promise<{
  showing: ShowingRow;
  feedback: ShowingFeedbackRow | null;
  contactName: string | null;
  siblingShowings: ShowingListItem[]; // same buyer, excluding current
} | null> {
  const { data: showingData, error } = await supabaseAdmin
    .from("showings")
    .select("*, contacts!inner(id, name, first_name, last_name, email)")
    .eq("agent_id", agentId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!showingData) return null;

  const withContact = showingData as ShowingRow & {
    contacts: {
      id: string;
      name: string | null;
      first_name: string | null;
      last_name: string | null;
      email: string | null;
    } | null;
  };
  const c = withContact.contacts;
  const contactName =
    (c?.first_name || c?.last_name
      ? `${c?.first_name ?? ""} ${c?.last_name ?? ""}`.trim()
      : c?.name) ?? c?.email ?? null;

  // Feedback + other showings for the same buyer, in parallel.
  const [{ data: fbData }, siblings] = await Promise.all([
    supabaseAdmin.from("showing_feedback").select("*").eq("showing_id", id).maybeSingle(),
    listShowingsForAgent(agentId, { contactId: withContact.contact_id }),
  ]);

  const { contacts: _contacts, ...rest } = withContact as ShowingRow & { contacts?: unknown };
  void _contacts;

  return {
    showing: rest as ShowingRow,
    feedback: (fbData as ShowingFeedbackRow | null) ?? null,
    contactName,
    siblingShowings: siblings.filter((s) => s.id !== id),
  };
}

// ── UPDATE ────────────────────────────────────────────────────────────

export type UpdateShowingInput = Partial<{
  property_address: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  mls_number: string | null;
  mls_url: string | null;
  scheduled_at: string;
  duration_minutes: number | null;
  access_notes: string | null;
  listing_agent_name: string | null;
  listing_agent_email: string | null;
  listing_agent_phone: string | null;
  status: ShowingStatus;
  cancellation_reason: string | null;
  notes: string | null;
}>;

export async function updateShowing(
  agentId: string,
  id: string,
  input: UpdateShowingInput,
): Promise<ShowingRow | null> {
  // Snapshot pre-update state so we can detect whether the Google event
  // needs re-syncing (time/address change) and whether status moved to
  // cancelled (delete the event).
  const { data: before } = await supabaseAdmin
    .from("showings")
    .select("*")
    .eq("id", id)
    .eq("agent_id", agentId)
    .maybeSingle();
  if (!before) return null;

  const patch = { ...input, updated_at: new Date().toISOString() };
  const { data, error } = await supabaseAdmin
    .from("showings")
    .update(patch)
    .eq("id", id)
    .eq("agent_id", agentId)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  const after = (data as ShowingRow | null) ?? null;
  if (!after) return null;

  // If the status just flipped to cancelled, drop the Google event.
  // Other status transitions (scheduled → attended) keep the event;
  // the agent may want it on their calendar as a historical record.
  const beforeStatus = (before as ShowingRow).status;
  const statusChanged = input.status !== undefined && input.status !== beforeStatus;
  if (statusChanged && input.status === "cancelled" && after.google_event_id) {
    await deleteShowingFromGoogle(agentId, after.google_event_id);
    await supabaseAdmin
      .from("showings")
      .update({ google_event_id: null })
      .eq("id", id);
    after.google_event_id = null;
    return after;
  }

  // If time/address changed and we still have an event, push the update.
  if (needsResync(before as ShowingRow, input) && after.status !== "cancelled") {
    const contactName = await fetchContactDisplayName(after.contact_id);
    const { googleEventId } = await syncShowingToGoogle(after, contactName);
    if (googleEventId && googleEventId !== after.google_event_id) {
      await supabaseAdmin
        .from("showings")
        .update({ google_event_id: googleEventId })
        .eq("id", id);
      after.google_event_id = googleEventId;
    }
  }

  return after;
}

export async function deleteShowing(agentId: string, id: string): Promise<boolean> {
  // Read the Google event id BEFORE the row is gone so we can clean up
  // the remote calendar event.
  const { data: before } = await supabaseAdmin
    .from("showings")
    .select("google_event_id")
    .eq("id", id)
    .eq("agent_id", agentId)
    .maybeSingle();
  const googleEventId =
    (before as { google_event_id: string | null } | null)?.google_event_id ?? null;

  const { error, count } = await supabaseAdmin
    .from("showings")
    .delete({ count: "exact" })
    .eq("id", id)
    .eq("agent_id", agentId);
  if (error) throw new Error(error.message);
  const deleted = (count ?? 0) > 0;

  if (deleted && googleEventId) {
    await deleteShowingFromGoogle(agentId, googleEventId);
  }
  return deleted;
}

/**
 * Lightweight contact-name lookup for calendar-event titles. Not part of
 * the public API — just a helper so the sync call sites stay readable.
 */
async function fetchContactDisplayName(contactId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("contacts")
    .select("first_name, last_name, email, name")
    .eq("id", contactId)
    .maybeSingle();
  const c = data as {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    name: string | null;
  } | null;
  if (!c) return null;
  const joined = `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim();
  return joined || c.name || c.email || null;
}

// ── Feedback ──────────────────────────────────────────────────────────

export type UpsertFeedbackInput = Partial<{
  rating: number | null;
  overall_reaction: OverallReaction | null;
  pros: string | null;
  cons: string | null;
  notes: string | null;
  would_offer: boolean;
  price_concerns: boolean;
  location_concerns: boolean;
  condition_concerns: boolean;
}>;

export async function upsertShowingFeedback(
  agentId: string,
  showingId: string,
  input: UpsertFeedbackInput,
): Promise<ShowingFeedbackRow> {
  // Verify the showing belongs to the agent before writing feedback.
  // `showing_feedback` has no agent_id directly; the join via
  // `showings.agent_id` is what scopes it.
  const { data: owned } = await supabaseAdmin
    .from("showings")
    .select("id")
    .eq("id", showingId)
    .eq("agent_id", agentId)
    .maybeSingle();
  if (!owned) throw new Error("Showing not found");

  const { data, error } = await supabaseAdmin
    .from("showing_feedback")
    .upsert(
      { showing_id: showingId, ...input, updated_at: new Date().toISOString() },
      { onConflict: "showing_id" },
    )
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Failed to save feedback");
  return data as ShowingFeedbackRow;
}

// ── Roll-ups ──────────────────────────────────────────────────────────

/**
 * Per-contact showing stats for the Contacts-page badge. Returns a Map
 * keyed by contact_id so callers can render a batch without N+1.
 */
export async function getContactShowingStats(
  agentId: string,
  contactIds: string[],
): Promise<Map<string, ContactShowingStats>> {
  if (contactIds.length === 0) return new Map();

  const { data: rows } = await supabaseAdmin
    .from("showings")
    .select("id, contact_id, status")
    .eq("agent_id", agentId)
    .in("contact_id", contactIds);
  const showings = (rows ?? []) as Array<{ id: string; contact_id: string; status: ShowingStatus }>;
  if (showings.length === 0) return new Map();

  const showingIds = showings.map((s) => s.id);
  const { data: fbRows } = await supabaseAdmin
    .from("showing_feedback")
    .select("showing_id, overall_reaction, would_offer")
    .in("showing_id", showingIds);
  const feedbackByShowing = new Map<
    string,
    { overall_reaction: OverallReaction | null; would_offer: boolean }
  >();
  for (const f of (fbRows ?? []) as Array<{
    showing_id: string;
    overall_reaction: OverallReaction | null;
    would_offer: boolean;
  }>) {
    feedbackByShowing.set(f.showing_id, f);
  }

  const stats = new Map<string, ContactShowingStats>();
  for (const s of showings) {
    const row = stats.get(s.contact_id) ?? {
      total: 0,
      attended: 0,
      scheduled: 0,
      loved: 0,
      wouldOfferCount: 0,
    };
    row.total += 1;
    if (s.status === "attended") row.attended += 1;
    if (s.status === "scheduled") row.scheduled += 1;
    const f = feedbackByShowing.get(s.id);
    if (f?.overall_reaction === "love") row.loved += 1;
    if (f?.would_offer) row.wouldOfferCount += 1;
    stats.set(s.contact_id, row);
  }
  return stats;
}
