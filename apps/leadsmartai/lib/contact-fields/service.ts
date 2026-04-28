import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import type { ContactFieldDef, FieldOption, FieldType } from "./types";
import {
  isValidFieldKey,
  pruneOrphanValues,
  validateValues,
  type ValidationResult,
} from "./values";

/**
 * Server-side service for contact custom fields.
 *
 * Two surfaces:
 *   - Field def CRUD (settings UI)
 *   - Per-contact value read / write (contact detail UI)
 *
 * Bypasses RLS via service role; routes authorize the calling
 * agent before invoking.
 */

export async function listFieldDefs(
  agentId: string,
): Promise<ContactFieldDef[]> {
  const { data } = await supabaseAdmin
    .from("agent_contact_field_defs")
    .select("*")
    .eq("agent_id", agentId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  return (data ?? []).map((r) => mapDefRow(r as Record<string, unknown>));
}

export async function createFieldDef(args: {
  agentId: string;
  fieldKey: string;
  label: string;
  fieldType: FieldType;
  options?: FieldOption[];
  isRequired?: boolean;
  sortOrder?: number;
}): Promise<ContactFieldDef> {
  if (!isValidFieldKey(args.fieldKey)) {
    throw new Error(
      "field_key must be snake_case, start with a letter, ≤50 chars",
    );
  }
  // For select/multiselect, options must be non-empty.
  const isSelect = args.fieldType === "select" || args.fieldType === "multiselect";
  const options = args.options ?? [];
  if (isSelect && options.length === 0) {
    throw new Error("select / multiselect fields require at least one option");
  }

  const { data, error } = await supabaseAdmin
    .from("agent_contact_field_defs")
    .insert({
      agent_id: args.agentId,
      field_key: args.fieldKey,
      label: args.label.trim(),
      field_type: args.fieldType,
      options,
      is_required: args.isRequired ?? false,
      sort_order: args.sortOrder ?? 0,
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Failed to create field def");
  return mapDefRow(data as Record<string, unknown>);
}

export async function updateFieldDef(args: {
  id: string;
  label?: string;
  options?: FieldOption[];
  isRequired?: boolean;
  sortOrder?: number;
}): Promise<ContactFieldDef | null> {
  const patch: Record<string, unknown> = {};
  if (args.label !== undefined) patch.label = args.label.trim();
  if (args.options !== undefined) patch.options = args.options;
  if (args.isRequired !== undefined) patch.is_required = args.isRequired;
  if (args.sortOrder !== undefined) patch.sort_order = args.sortOrder;

  const { data } = await supabaseAdmin
    .from("agent_contact_field_defs")
    .update(patch)
    .eq("id", args.id)
    .select("*")
    .single();
  return data ? mapDefRow(data as Record<string, unknown>) : null;
}

export async function deleteFieldDef(id: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("agent_contact_field_defs")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
}

/**
 * Read a contact's custom_fields, sanitized against the agent's
 * current def list. Orphan values (defs that have been deleted)
 * are pruned automatically so stale data doesn't leak through
 * the read path.
 */
export async function getContactCustomFields(args: {
  contactId: string;
  agentId: string;
}): Promise<{ defs: ContactFieldDef[]; values: Record<string, unknown> }> {
  const [defs, contact] = await Promise.all([
    listFieldDefs(args.agentId),
    supabaseAdmin
      .from("contacts")
      .select("custom_fields")
      .eq("id", args.contactId)
      .eq("agent_id", args.agentId)
      .maybeSingle(),
  ]);
  const stored =
    (contact.data as { custom_fields: Record<string, unknown> | null } | null)?.custom_fields ??
    {};
  return { defs, values: pruneOrphanValues(defs, stored as never) };
}

/**
 * Write a contact's custom_fields. Validates against the agent's
 * defs first; on any error returns the structured ValidationResult
 * WITHOUT writing anything. Caller can choose to surface the
 * errors and let the agent fix them.
 *
 * Writes the full set (replaces previous custom_fields). Use the
 * returned ValidationResult.coerced as the canonical shape.
 */
export async function updateContactCustomFields(args: {
  contactId: string;
  agentId: string;
  values: Record<string, unknown>;
}): Promise<ValidationResult> {
  const defs = await listFieldDefs(args.agentId);
  const result = validateValues(defs, args.values);
  if (!result.ok) return result;

  const { error } = await supabaseAdmin
    .from("contacts")
    .update({ custom_fields: result.coerced })
    .eq("id", args.contactId)
    .eq("agent_id", args.agentId);
  if (error) {
    // Surface the DB error as a synthetic single-field issue.
    return {
      ok: false,
      errors: { _db: "wrong_type" },
      coerced: result.coerced,
    };
  }
  return result;
}

// ── row mapper ──────────────────────────────────────────────────

function mapDefRow(row: Record<string, unknown>): ContactFieldDef {
  return {
    id: String(row.id ?? ""),
    agentId: String(row.agent_id ?? ""),
    fieldKey: String(row.field_key ?? ""),
    label: String(row.label ?? ""),
    fieldType: (row.field_type as FieldType) ?? "text",
    options: Array.isArray(row.options)
      ? (row.options as FieldOption[]).filter(
          (o) =>
            o &&
            typeof o === "object" &&
            typeof (o as FieldOption).value === "string",
        )
      : [],
    isRequired: Boolean(row.is_required),
    sortOrder: Number(row.sort_order ?? 0),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}
