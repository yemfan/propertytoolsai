import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import type {
  AlertFrequency,
  SavedSearch,
  SavedSearchCriteria,
} from "./types";

/**
 * Consumer-side saved-search service. Mirrors the agent-side service
 * in apps/leadsmartai/lib/contacts/savedSearches.ts but scoped to the
 * logged-in consumer rather than an agent — operations always run
 * against a single contactId that the caller has already resolved via
 * getCurrentConsumerContact().
 *
 * Writing to the same public.contact_saved_searches table as the agent
 * side: agents see what consumers saved without any sync.
 */

function mapRow(row: Record<string, unknown>): SavedSearch {
  return {
    id: String(row.id),
    contactId: String(row.contact_id),
    name: String(row.name ?? ""),
    criteria:
      row.criteria && typeof row.criteria === "object"
        ? (row.criteria as SavedSearchCriteria)
        : {},
    alertFrequency: ((row.alert_frequency as string) ?? "daily") as AlertFrequency,
    lastAlertedAt: (row.last_alerted_at as string | null) ?? null,
    lastMatchedListingIds: Array.isArray(row.last_matched_listing_ids)
      ? (row.last_matched_listing_ids as string[])
      : [],
    isActive: row.is_active !== false,
    createdAt: String(row.created_at ?? new Date().toISOString()),
    updatedAt: String(row.updated_at ?? new Date().toISOString()),
  };
}

export async function listConsumerSavedSearches(
  contactId: string,
  opts: { includeArchived?: boolean } = {},
): Promise<SavedSearch[]> {
  let q = supabaseAdmin
    .from("contact_saved_searches")
    .select("*")
    .eq("contact_id", contactId)
    .order("created_at", { ascending: false });
  if (!opts.includeArchived) q = q.eq("is_active", true as never);
  const { data, error } = await q;
  if (error) {
    if (
      (error as { code?: string }).code === "42P01" ||
      /does not exist|schema cache/i.test((error as { message?: string }).message ?? "")
    ) {
      return [];
    }
    throw error;
  }
  return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
}

export type CreateConsumerSavedSearchInput = {
  name: string;
  criteria: SavedSearchCriteria;
  alertFrequency?: AlertFrequency;
};

export async function createConsumerSavedSearch(
  contactId: string,
  input: CreateConsumerSavedSearchInput,
): Promise<SavedSearch> {
  const name = input.name.trim().slice(0, 120);
  if (!name) throw new Error("name required");

  // Inherit agent_id from the contact so agent-side queries stay scoped
  // correctly. If the contact is unassigned (lifecycle_stage='lead'
  // pre-assignment), agent_id will be null — that's fine.
  const { data: contactRow } = await supabaseAdmin
    .from("contacts")
    .select("agent_id")
    .eq("id", contactId)
    .maybeSingle();
  const agentId = (contactRow as { agent_id: unknown } | null)?.agent_id ?? null;

  const { data, error } = await supabaseAdmin
    .from("contact_saved_searches")
    .insert({
      contact_id: contactId,
      agent_id: agentId as never,
      name,
      criteria: (input.criteria ?? {}) as never,
      alert_frequency: input.alertFrequency ?? "daily",
      is_active: true,
    } as never)
    .select("*")
    .single();
  if (error) throw error;

  // Fire saved_search_created event so the leadsmartai scoring cron
  // picks it up on its next run. This is the bridge that makes
  // consumer activity visible to the agent.
  try {
    const row = data as Record<string, unknown>;
    await supabaseAdmin.from("contact_events").insert({
      contact_id: contactId,
      agent_id: agentId as never,
      event_type: "saved_search_created",
      payload: {
        saved_search_id: String(row.id),
        name,
        criteria: input.criteria ?? {},
      } as never,
      source: "consumer_web",
    } as never);
  } catch (e) {
    console.error("[consumer/savedSearches] event log failed", e);
  }

  return mapRow(data as Record<string, unknown>);
}

async function assertOwnership(contactId: string, searchId: string): Promise<void> {
  const { data } = await supabaseAdmin
    .from("contact_saved_searches")
    .select("contact_id")
    .eq("id", searchId)
    .maybeSingle();
  if (!data) throw new Error("Saved search not found");
  const row = data as { contact_id: string };
  if (row.contact_id !== contactId) throw new Error("Saved search does not belong to this user");
}

export type UpdateConsumerSavedSearchInput = {
  name?: string;
  criteria?: SavedSearchCriteria;
  alertFrequency?: AlertFrequency;
  isActive?: boolean;
};

export async function updateConsumerSavedSearch(
  contactId: string,
  searchId: string,
  patch: UpdateConsumerSavedSearchInput,
): Promise<SavedSearch> {
  await assertOwnership(contactId, searchId);

  const update: Record<string, unknown> = {};
  if (patch.name !== undefined) {
    const trimmed = patch.name.trim().slice(0, 120);
    if (!trimmed) throw new Error("name cannot be empty");
    update.name = trimmed;
  }
  if (patch.criteria !== undefined) update.criteria = patch.criteria;
  if (patch.alertFrequency !== undefined) update.alert_frequency = patch.alertFrequency;
  if (patch.isActive !== undefined) update.is_active = patch.isActive;

  const { data, error } = await supabaseAdmin
    .from("contact_saved_searches")
    .update(update as never)
    .eq("id", searchId)
    .select("*")
    .single();
  if (error) throw error;
  return mapRow(data as Record<string, unknown>);
}

export async function archiveConsumerSavedSearch(
  contactId: string,
  searchId: string,
): Promise<void> {
  await assertOwnership(contactId, searchId);
  const { error } = await supabaseAdmin
    .from("contact_saved_searches")
    .update({ is_active: false } as never)
    .eq("id", searchId);
  if (error) throw error;
}
