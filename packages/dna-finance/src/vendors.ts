import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@helm/data/types";

type Db = SupabaseClient<Database>;

export interface VendorInput {
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  is1099: boolean;
}

/** Create a vendor. Org-scoped; caller revalidates. */
export async function insertVendor(db: Db, orgId: string, input: VendorInput): Promise<void> {
  if (!input.name.trim()) throw new Error("Vendor name is required");
  const { error } = await db.from("vendors").insert({
    organization_id: orgId,
    name: input.name.trim(),
    email: input.email,
    phone: input.phone,
    notes: input.notes,
    is_1099: input.is1099,
  });
  if (error) throw new Error(error.message);
}

/** Update a vendor. Org-scoped. */
export async function updateVendor(db: Db, orgId: string, id: string, input: VendorInput): Promise<void> {
  if (!input.name.trim()) throw new Error("Vendor name is required");
  const { error } = await db
    .from("vendors")
    .update({
      name: input.name.trim(),
      email: input.email,
      phone: input.phone,
      notes: input.notes,
      is_1099: input.is1099,
    })
    .eq("id", id)
    .eq("organization_id", orgId);
  if (error) throw new Error(error.message);
}

/** Delete a vendor. Org-scoped. */
export async function deleteVendor(db: Db, orgId: string, id: string): Promise<void> {
  await db.from("vendors").delete().eq("id", id).eq("organization_id", orgId);
}
