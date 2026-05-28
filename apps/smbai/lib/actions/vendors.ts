"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type Vendor = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  created_at: string;
};

export type VendorWithSpend = Vendor & {
  totalBilled: number; // all bills matching this vendor name
  totalPaid: number;   // paid bills only
  openAmount: number;  // open bills only
  openCount: number;
  billCount: number;
};

async function getOrgId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get("smbai-org-id")?.value ?? null;
}

/** Vendors with spend matched from bills by (case-insensitive) name. */
export async function listVendorsWithSpend(): Promise<VendorWithSpend[]> {
  const orgId = await getOrgId();
  if (!orgId) return [];
  const supabase = await createClient();

  const [vendorsRes, billsRes] = await Promise.all([
    supabase.from("vendors").select("*").eq("organization_id", orgId).order("name"),
    supabase.from("bills").select("vendor, amount, status").eq("organization_id", orgId),
  ]);

  type Spend = { billed: number; paid: number; openAmount: number; openCount: number; count: number };
  const spend = new Map<string, Spend>();
  for (const b of billsRes.data ?? []) {
    const key = (b.vendor ?? "").trim().toLowerCase();
    if (!key) continue;
    const s = spend.get(key) ?? { billed: 0, paid: 0, openAmount: 0, openCount: 0, count: 0 };
    const amt = Number(b.amount) || 0;
    s.billed += amt;
    s.count += 1;
    if (b.status === "paid") {
      s.paid += amt;
    } else {
      s.openAmount += amt;
      s.openCount += 1;
    }
    spend.set(key, s);
  }

  return (vendorsRes.data ?? []).map((v) => {
    const s = spend.get((v.name ?? "").trim().toLowerCase());
    return {
      ...v,
      totalBilled: s?.billed ?? 0,
      totalPaid: s?.paid ?? 0,
      openAmount: s?.openAmount ?? 0,
      openCount: s?.openCount ?? 0,
      billCount: s?.count ?? 0,
    };
  }) as VendorWithSpend[];
}

/** Just the names — for the bill-form autocomplete datalist. */
export async function listVendorNames(): Promise<string[]> {
  const orgId = await getOrgId();
  if (!orgId) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("vendors")
    .select("name")
    .eq("organization_id", orgId)
    .order("name");
  return (data ?? []).map((v) => v.name as string);
}

export async function createVendor(input: {
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
}): Promise<void> {
  const orgId = await getOrgId();
  if (!orgId) throw new Error("No org");
  if (!input.name.trim()) throw new Error("Vendor name is required");

  const supabase = await createClient();
  const { error } = await supabase.from("vendors").insert({
    organization_id: orgId,
    name: input.name.trim(),
    email: input.email,
    phone: input.phone,
    notes: input.notes,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/books/vendors");
}

export async function updateVendor(
  id: string,
  input: { name: string; email: string | null; phone: string | null; notes: string | null }
): Promise<void> {
  const orgId = await getOrgId();
  if (!orgId) throw new Error("No org");
  if (!input.name.trim()) throw new Error("Vendor name is required");

  const supabase = await createClient();
  const { error } = await supabase
    .from("vendors")
    .update({
      name: input.name.trim(),
      email: input.email,
      phone: input.phone,
      notes: input.notes,
    })
    .eq("id", id)
    .eq("organization_id", orgId);
  if (error) throw new Error(error.message);
  revalidatePath("/books/vendors");
}

export async function deleteVendor(id: string): Promise<void> {
  const orgId = await getOrgId();
  if (!orgId) throw new Error("No org");
  const supabase = await createClient();
  await supabase.from("vendors").delete().eq("id", id).eq("organization_id", orgId);
  revalidatePath("/books/vendors");
}
