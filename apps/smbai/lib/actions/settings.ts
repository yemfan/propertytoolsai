"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

export type SettingsState = { error?: string; success?: boolean } | null;

// ── Update org info ────────────────────────────────────────────────────────────

export async function updateOrg(
  _: SettingsState,
  formData: FormData
): Promise<SettingsState> {
  const cookieStore = await cookies();
  const orgId = cookieStore.get("helmsmart-org-id")?.value;
  if (!orgId) return { error: "No organization found." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized." };

  const name = (formData.get("name") as string)?.trim();
  if (!name) return { error: "Business name is required." };

  const { error } = await supabase
    .from("organizations")
    .update({
      name,
      timezone: (formData.get("timezone") as string) || "America/New_York",
      fiscal_year_end_month: Number(formData.get("fiscal_year_end_month")) || 12,
      weekly_digest_enabled: formData.get("weekly_digest_enabled") === "on",
      owner_english_assist: formData.get("owner_english_assist") === "on",
    })
    .eq("id", orgId);

  if (error) {
    console.error("updateOrg failed:", error);
    return { error: `Couldn't save: ${error.message}` };
  }

  revalidatePath("/settings");
  return { success: true };
}

// ── Billing rates (Financial tab) ─────────────────────────────────────────────

export async function saveBillingRates(input: {
  hourlyRate: number | null;
  laborCostRate: number | null;
}): Promise<SettingsState> {
  const cookieStore = await cookies();
  const orgId = cookieStore.get("helmsmart-org-id")?.value;
  if (!orgId) return { error: "No organization found." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized." };

  const { error } = await supabase
    .from("organizations")
    .update({
      default_hourly_rate: input.hourlyRate,
      default_labor_cost_rate: input.laborCostRate,
    })
    .eq("id", orgId);

  if (error) return { error: `Couldn't save: ${error.message}` };

  revalidatePath("/settings");
  return { success: true };
}

// ── Link bank account → CoA account ───────────────────────────────────────────
// This mapping is required for journal posting to work (DR/CR the right asset account).

export async function linkBankAccountToCoa(
  _: SettingsState,
  formData: FormData
): Promise<SettingsState> {
  const bankAccountId = formData.get("bank_account_id") as string;
  const coaAccountId = (formData.get("coa_account_id") as string) || null;

  if (!bankAccountId) return { error: "Missing bank account." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized." };

  const { error } = await supabase
    .from("bank_accounts")
    .update({ coa_account_id: coaAccountId })
    .eq("id", bankAccountId);

  if (error) return { error: "Failed to update account link." };

  revalidatePath("/settings");
  return { success: true };
}
