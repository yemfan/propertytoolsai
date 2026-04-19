import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Agent-side read access to a contact's favorites. Consumers maintain
 * the list via propertytoolsai's /api/consumer/favorites; agents only
 * need to see + filter it to build the "what this contact likes"
 * context on their CRM profile.
 */

export type ContactFavorite = {
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
};

function mapRow(row: Record<string, unknown>): ContactFavorite {
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
  };
}

export async function listContactFavorites(
  agentId: string | number,
  contactId: string,
): Promise<ContactFavorite[]> {
  // Ensure the contact belongs to this agent before returning data.
  const { data: contactRow } = await supabaseAdmin
    .from("contacts")
    .select("id")
    .eq("id", contactId)
    .eq("agent_id", agentId as never)
    .maybeSingle();
  if (!contactRow) return [];

  const { data, error } = await supabaseAdmin
    .from("contact_property_favorites")
    .select("*")
    .eq("contact_id", contactId)
    .order("created_at", { ascending: false })
    .limit(50);
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
