"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { EstimateLine } from "@/lib/actions/estimates";

export type EstimateTemplate = {
  id: string;
  name: string;
  tax_rate: number;   // fraction (0.0875)
  notes: string | null;
  lines: EstimateLine[];
};

async function getOrgId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get("smbai-org-id")?.value ?? null;
}

export async function listEstimateTemplates(): Promise<EstimateTemplate[]> {
  const orgId = await getOrgId();
  if (!orgId) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("estimate_templates")
    .select("id, name, tax_rate, notes, lines")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });
  return (data ?? []) as EstimateTemplate[];
}

export async function createEstimateTemplate(data: {
  name: string;
  taxRate: number;        // fraction, matching estimates.tax_rate
  notes: string | null;
  lines: EstimateLine[];
}): Promise<string> {
  const orgId = await getOrgId();
  if (!orgId) throw new Error("No org");
  if (!data.name.trim()) throw new Error("Template name is required");
  if (!data.lines.length) throw new Error("Add at least one line item");

  const supabase = await createClient();
  const { data: tpl, error } = await supabase
    .from("estimate_templates")
    .insert({
      organization_id: orgId,
      name: data.name.trim(),
      tax_rate: data.taxRate,
      notes: data.notes,
      lines: data.lines,
    })
    .select("id")
    .single();

  if (error || !tpl) throw new Error(error?.message ?? "Failed to save template");

  revalidatePath("/books/estimates/templates");
  revalidatePath("/books/estimates/new");
  return tpl.id;
}

export async function deleteEstimateTemplate(id: string): Promise<void> {
  const orgId = await getOrgId();
  if (!orgId) throw new Error("No org");
  const supabase = await createClient();
  await supabase
    .from("estimate_templates")
    .delete()
    .eq("id", id)
    .eq("organization_id", orgId);
  revalidatePath("/books/estimates/templates");
}
