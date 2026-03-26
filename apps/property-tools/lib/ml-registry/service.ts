import { supabaseAdmin } from "@/lib/supabase/admin";
import type { RegisteredModel } from "./types";

function rowToRegisteredModel(row: Record<string, unknown>): RegisteredModel {
  return {
    id: String(row.id),
    modelKey: String(row.model_key),
    modelVersion: String(row.model_version),
    status: row.status as RegisteredModel["status"],
    backend: String(row.backend),
    artifactPath: String(row.artifact_path),
    schemaPath: String(row.schema_path),
    metrics: (row.metrics_json as Record<string, unknown>) ?? {},
    filters: (row.filters_json as Record<string, unknown>) ?? {},
    rowsUsed: Number(row.rows_used ?? 0),
    trainedAt: String(row.trained_at),
    trainedBy: row.trained_by != null ? String(row.trained_by) : null,
    notes: row.notes != null ? String(row.notes) : null,
    isActive: Boolean(row.is_active),
  };
}

export async function registerModel(params: {
  modelKey: string;
  modelVersion: string;
  backend: string;
  artifactPath: string;
  schemaPath: string;
  metrics: Record<string, unknown>;
  filters?: Record<string, unknown>;
  rowsUsed: number;
  trainedBy?: string | null;
  notes?: string | null;
  status?: "candidate" | "active" | "archived";
  isActive?: boolean;
}): Promise<RegisteredModel> {
  const { data, error } = await supabaseAdmin
    .from("ml_models")
    .insert({
      model_key: params.modelKey,
      model_version: params.modelVersion,
      status: params.status || "candidate",
      backend: params.backend,
      artifact_path: params.artifactPath,
      schema_path: params.schemaPath,
      metrics_json: params.metrics,
      filters_json: params.filters || {},
      rows_used: params.rowsUsed,
      trained_by: params.trainedBy || null,
      notes: params.notes ?? null,
      is_active: Boolean(params.isActive),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return rowToRegisteredModel(data as Record<string, unknown>);
}

export async function listModels(modelKey = "valuation_avm"): Promise<RegisteredModel[]> {
  const { data, error } = await supabaseAdmin
    .from("ml_models")
    .select("*")
    .eq("model_key", modelKey)
    .order("trained_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map((row) => rowToRegisteredModel(row as Record<string, unknown>));
}

export async function activateModel(modelId: string, modelKey = "valuation_avm"): Promise<RegisteredModel> {
  await supabaseAdmin
    .from("ml_models")
    .update({ is_active: false, status: "archived", updated_at: new Date().toISOString() })
    .eq("model_key", modelKey)
    .eq("is_active", true);

  const { data, error } = await supabaseAdmin
    .from("ml_models")
    .update({ is_active: true, status: "active", updated_at: new Date().toISOString() })
    .eq("id", modelId)
    .select()
    .single();

  if (error) throw error;
  return rowToRegisteredModel(data as Record<string, unknown>);
}

export async function getActiveModel(modelKey = "valuation_avm") {
  const { data, error } = await supabaseAdmin
    .from("ml_models")
    .select("*")
    .eq("model_key", modelKey)
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw error;
  return data ? rowToRegisteredModel(data as Record<string, unknown>) : null;
}
