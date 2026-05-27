"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Recalculates and updates a client's lifetime_value from paid invoices.
 * Called after marking an invoice paid (session auth or service role).
 */
export async function refreshClientLifetimeValue(clientId: string, orgId: string) {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("invoices")
    .select("total")
    .eq("client_id", clientId)
    .eq("organization_id", orgId)
    .eq("status", "paid");

  const lifetime = (data ?? []).reduce((s, i) => s + Number(i.total), 0);
  await supabase
    .from("clients")
    .update({ lifetime_value: lifetime })
    .eq("id", clientId)
    .eq("organization_id", orgId);
}

export type ClientState = { error?: string; success?: boolean } | null;

// ── Create ────────────────────────────────────────────────────────────────────

export async function createClient_(
  _: ClientState,
  formData: FormData
): Promise<ClientState> {
  const firstName = (formData.get("first_name") as string)?.trim();
  if (!firstName) return { error: "First name is required." };

  const cookieStore = await cookies();
  const orgId = cookieStore.get("smbai-org-id")?.value;
  if (!orgId) return { error: "No organization found." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized." };

  const tagsRaw = (formData.get("tags") as string)?.trim();
  const tags = tagsRaw ? tagsRaw.split(",").map((t) => t.trim()).filter(Boolean) : [];

  const { error } = await supabase.from("clients").insert({
    organization_id: orgId,
    first_name: firstName,
    last_name: (formData.get("last_name") as string)?.trim() || null,
    company: (formData.get("company") as string)?.trim() || null,
    email: (formData.get("email") as string)?.trim() || null,
    phone: (formData.get("phone") as string)?.trim() || null,
    status: (formData.get("status") as string) || "lead",
    source: (formData.get("source") as string)?.trim() || null,
    notes: (formData.get("notes") as string)?.trim() || null,
    tags: tags.length ? tags : null,
  });

  if (error) {
    console.error("[clients] create error:", error);
    return { error: "Failed to create client." };
  }

  revalidatePath("/clients");
  return { success: true };
}

// ── Update ────────────────────────────────────────────────────────────────────

export async function updateClient(
  _: ClientState,
  formData: FormData
): Promise<ClientState> {
  const clientId = formData.get("client_id") as string;
  if (!clientId) return { error: "Missing client ID." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized." };

  const tagsRaw = (formData.get("tags") as string)?.trim();
  const tags = tagsRaw ? tagsRaw.split(",").map((t) => t.trim()).filter(Boolean) : [];

  const { error } = await supabase
    .from("clients")
    .update({
      first_name: (formData.get("first_name") as string)?.trim(),
      last_name: (formData.get("last_name") as string)?.trim() || null,
      company: (formData.get("company") as string)?.trim() || null,
      email: (formData.get("email") as string)?.trim() || null,
      phone: (formData.get("phone") as string)?.trim() || null,
      status: (formData.get("status") as string) || "lead",
      source: (formData.get("source") as string)?.trim() || null,
      notes: (formData.get("notes") as string)?.trim() || null,
      tags: tags.length ? tags : null,
    })
    .eq("id", clientId);

  if (error) return { error: "Failed to update client." };

  revalidatePath("/clients");
  revalidatePath(`/clients/${clientId}`);
  return { success: true };
}

// ── Delete ────────────────────────────────────────────────────────────────────

export async function deleteClient(clientId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized." };

  const { error } = await supabase.from("clients").delete().eq("id", clientId);
  if (error) return { error: "Failed to delete client." };

  revalidatePath("/clients");
  return {};
}
