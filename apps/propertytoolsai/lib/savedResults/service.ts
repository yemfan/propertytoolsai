import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";

export type SavedResultRow = {
  id: string;
  user_id: string;
  tool: string;
  label: string | null;
  property_address: string | null;
  inputs: Record<string, unknown>;
  results: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type CreateSavedResultInput = {
  userId: string;
  tool: string;
  label?: string | null;
  propertyAddress?: string | null;
  inputs: Record<string, unknown>;
  results: Record<string, unknown>;
};

/**
 * Create a saved-result row for the authenticated user. Keeps no
 * history — each save is a brand-new row, which lets the user build a
 * collection of named scenarios instead of overwriting a single record.
 */
export async function createSavedResult(
  input: CreateSavedResultInput,
): Promise<SavedResultRow> {
  const { data, error } = await supabaseAdmin
    .from("saved_tool_results")
    .insert({
      user_id: input.userId,
      tool: input.tool,
      label: input.label ?? null,
      property_address: input.propertyAddress ?? null,
      inputs: input.inputs,
      results: input.results,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as SavedResultRow;
}

export async function listSavedResultsForUser(
  userId: string,
): Promise<SavedResultRow[]> {
  const { data, error } = await supabaseAdmin
    .from("saved_tool_results")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return (data ?? []) as SavedResultRow[];
}

export async function deleteSavedResult(
  userId: string,
  id: string,
): Promise<boolean> {
  const { error, count } = await supabaseAdmin
    .from("saved_tool_results")
    .delete({ count: "exact" })
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}
