import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import type {
  AlertFrequency,
  SavedSearch,
  SavedSearchCriteria,
} from "./types";

/**
 * Saved-search CRUD. All reads and writes are scoped to an agent so one
 * agent can never touch another agent's contacts' searches. Authorization
 * is enforced at every boundary — the API route passes the agent context
 * down; the service re-verifies that the contact belongs to that agent
 * before any write.
 *
 * Archive semantics: delete is soft — `is_active=false` preserves history
 * so the matcher log + dedup state stays coherent if an agent restores.
 * Hard delete via an admin UI/SQL if ever needed.
 */

function mapRow(row: Record<string, unknown>): SavedSearch {
  return {
    id: String(row.id),
    contactId: String(row.contact_id),
    agentId: (row.agent_id as string | number | null) ?? null,
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

function isMissingRelationError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; message?: string };
  return (
    e.code === "42P01" ||
    e.code === "42703" ||
    /does not exist|schema cache/i.test(e.message ?? "")
  );
}

async function assertContactBelongsToAgent(
  agentId: string | number,
  contactId: string,
): Promise<void> {
  const { data } = await supabaseAdmin
    .from("contacts")
    .select("id")
    .eq("id", contactId)
    .eq("agent_id", agentId as never)
    .maybeSingle();
  if (!data) throw new Error("Contact does not belong to this agent");
}

async function assertSearchBelongsToAgent(
  agentId: string | number,
  searchId: string,
): Promise<string> {
  const { data } = await supabaseAdmin
    .from("contact_saved_searches")
    .select("id, contact_id, agent_id")
    .eq("id", searchId)
    .maybeSingle();
  if (!data) throw new Error("Saved search not found");
  const row = data as { id: string; contact_id: string; agent_id: unknown };
  // agent_id on the row is authoritative when set. When null (legacy or
  // pre-assignment), fall back to the contact's owner.
  if (row.agent_id != null) {
    if (String(row.agent_id) !== String(agentId)) {
      throw new Error("Saved search does not belong to this agent");
    }
    return row.contact_id;
  }
  await assertContactBelongsToAgent(agentId, row.contact_id);
  return row.contact_id;
}

export type ListSavedSearchesOpts = {
  /** Scope to one contact. Omit to return all the agent's searches. */
  contactId?: string;
  includeArchived?: boolean;
};

export async function listSavedSearches(
  agentId: string | number,
  opts: ListSavedSearchesOpts = {},
): Promise<SavedSearch[]> {
  let q = supabaseAdmin
    .from("contact_saved_searches")
    .select("*")
    .eq("agent_id", agentId as never)
    .order("created_at", { ascending: false });
  if (opts.contactId) q = q.eq("contact_id", opts.contactId);
  if (!opts.includeArchived) q = q.eq("is_active", true as never);
  const { data, error } = await q;
  if (error) {
    if (isMissingRelationError(error)) return [];
    throw error;
  }
  return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
}

export async function getSavedSearch(
  agentId: string | number,
  searchId: string,
): Promise<SavedSearch | null> {
  await assertSearchBelongsToAgent(agentId, searchId);
  const { data } = await supabaseAdmin
    .from("contact_saved_searches")
    .select("*")
    .eq("id", searchId)
    .maybeSingle();
  if (!data) return null;
  return mapRow(data as Record<string, unknown>);
}

export type CreateSavedSearchInput = {
  contactId: string;
  name: string;
  criteria: SavedSearchCriteria;
  alertFrequency?: AlertFrequency;
};

export async function createSavedSearch(
  agentId: string | number,
  input: CreateSavedSearchInput,
): Promise<SavedSearch> {
  await assertContactBelongsToAgent(agentId, input.contactId);
  const name = input.name.trim().slice(0, 120);
  if (!name) throw new Error("name required");

  const { data, error } = await supabaseAdmin
    .from("contact_saved_searches")
    .insert({
      contact_id: input.contactId,
      agent_id: agentId as never,
      name,
      criteria: (input.criteria ?? {}) as never,
      alert_frequency: input.alertFrequency ?? "daily",
      is_active: true,
    } as never)
    .select("*")
    .single();
  if (error) throw error;

  // Fire-and-forget behavioral event so the scoring cron picks up the
  // "saved_search_created" signal on its next run. Using supabase
  // directly rather than HTTP self-call avoids the network hop.
  try {
    const row = data as Record<string, unknown>;
    await supabaseAdmin.from("contact_events").insert({
      contact_id: input.contactId,
      agent_id: agentId as never,
      event_type: "saved_search_created",
      payload: {
        saved_search_id: String(row.id),
        name,
        criteria: input.criteria ?? {},
      } as never,
      source: "system",
    } as never);
  } catch (e) {
    console.error("[savedSearches] failed to log saved_search_created event", e);
  }

  return mapRow(data as Record<string, unknown>);
}

export type UpdateSavedSearchInput = {
  name?: string;
  criteria?: SavedSearchCriteria;
  alertFrequency?: AlertFrequency;
  isActive?: boolean;
};

export async function updateSavedSearch(
  agentId: string | number,
  searchId: string,
  patch: UpdateSavedSearchInput,
): Promise<SavedSearch> {
  await assertSearchBelongsToAgent(agentId, searchId);

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

/**
 * Soft-delete: sets is_active=false. Preserves matcher history + dedup
 * state. To hard-delete, use SQL directly.
 */
export async function archiveSavedSearch(
  agentId: string | number,
  searchId: string,
): Promise<void> {
  await assertSearchBelongsToAgent(agentId, searchId);
  const { error } = await supabaseAdmin
    .from("contact_saved_searches")
    .update({ is_active: false } as never)
    .eq("id", searchId);
  if (error) throw error;
}
