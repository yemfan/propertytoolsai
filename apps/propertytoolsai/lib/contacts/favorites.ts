import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Consumer-scoped favorites CRUD. Writes to the shared
 * public.contact_property_favorites table so agents on leadsmartai
 * see the favorites in real time.
 *
 * The caller has already resolved contactId via
 * getCurrentConsumerContact(). All writes scope to that contactId —
 * there's no way for a logged-in user to manipulate another user's
 * favorites through this path.
 */

export type Favorite = {
  id: string;
  contactId: string;
  propertyId: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  price: number | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  propertyType: string | null;
  photoUrl: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

function mapRow(row: Record<string, unknown>): Favorite {
  const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  return {
    id: String(row.id),
    contactId: String(row.contact_id),
    propertyId: String(row.property_id),
    address: (row.address as string | null) ?? null,
    city: (row.city as string | null) ?? null,
    state: (row.state as string | null) ?? null,
    zip: (row.zip as string | null) ?? null,
    price: num(row.price),
    beds: num(row.beds),
    baths: num(row.baths),
    sqft: num(row.sqft),
    propertyType: (row.property_type as string | null) ?? null,
    photoUrl: (row.photo_url as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    createdAt: String(row.created_at ?? new Date().toISOString()),
    updatedAt: String(row.updated_at ?? new Date().toISOString()),
  };
}

export async function listConsumerFavorites(contactId: string): Promise<Favorite[]> {
  const { data, error } = await supabaseAdmin
    .from("contact_property_favorites")
    .select("*")
    .eq("contact_id", contactId)
    .order("created_at", { ascending: false });
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

export type AddFavoriteInput = {
  propertyId: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  price?: number;
  beds?: number;
  baths?: number;
  sqft?: number;
  propertyType?: string;
  photoUrl?: string;
  notes?: string;
};

export async function addConsumerFavorite(
  contactId: string,
  input: AddFavoriteInput,
): Promise<Favorite> {
  if (!input.propertyId.trim()) throw new Error("propertyId required");

  // Inherit agent ownership from the contact so agent-side queries
  // can filter by agent_id.
  const { data: contactRow } = await supabaseAdmin
    .from("contacts")
    .select("agent_id")
    .eq("id", contactId)
    .maybeSingle();
  const agentId = (contactRow as { agent_id: unknown } | null)?.agent_id ?? null;

  // Upsert on (contact_id, property_id) unique — second favorite on
  // the same listing just refreshes updated_at + the snapshot.
  const { data, error } = await supabaseAdmin
    .from("contact_property_favorites")
    .upsert(
      {
        contact_id: contactId,
        agent_id: agentId as never,
        property_id: input.propertyId.trim(),
        address: input.address ?? null,
        city: input.city ?? null,
        state: input.state ?? null,
        zip: input.zip ?? null,
        price: input.price ?? null,
        beds: input.beds ?? null,
        baths: input.baths ?? null,
        sqft: input.sqft ?? null,
        property_type: input.propertyType ?? null,
        photo_url: input.photoUrl ?? null,
        notes: input.notes ?? null,
      } as never,
      { onConflict: "contact_id,property_id" },
    )
    .select("*")
    .single();
  if (error) throw error;

  // Fire property_favorite event so the scoring cron counts it (weight 6).
  try {
    await supabaseAdmin.from("contact_events").insert({
      contact_id: contactId,
      agent_id: agentId as never,
      event_type: "property_favorite",
      source: "consumer_web",
      payload: {
        property_id: input.propertyId,
        address: input.address,
        price: input.price,
      } as never,
    } as never);
  } catch (e) {
    console.error("[favorites] event log failed", e);
  }

  return mapRow(data as Record<string, unknown>);
}

export async function removeConsumerFavorite(
  contactId: string,
  propertyId: string,
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("contact_property_favorites")
    .delete()
    .eq("contact_id", contactId)
    .eq("property_id", propertyId);
  if (error) throw error;

  // Log the remove — useful for the scoring engine to capture the
  // "no longer interested" signal (negative intent).
  try {
    const { data: contactRow } = await supabaseAdmin
      .from("contacts")
      .select("agent_id")
      .eq("id", contactId)
      .maybeSingle();
    const agentId = (contactRow as { agent_id: unknown } | null)?.agent_id ?? null;
    await supabaseAdmin.from("contact_events").insert({
      contact_id: contactId,
      agent_id: agentId as never,
      event_type: "favorite_removed",
      source: "consumer_web",
      payload: { property_id: propertyId } as never,
    } as never);
  } catch {
    // swallow — removal itself already succeeded
  }
}
