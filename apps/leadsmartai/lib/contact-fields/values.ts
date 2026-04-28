/**
 * Pure value coercion + validation for contact custom fields.
 *
 * Two functions:
 *   - `coerceFieldValue(def, raw)` — tighten a free-form input
 *     to the field's declared type. Returns null for "explicitly
 *     blank" so the agent can clear a value
 *   - `validateValues(defs, values)` — checks every value
 *     against its def + flags required-but-empty. Returns a
 *     structured error map keyed by field_key
 *
 * Pure — vitest hits each type branch.
 */

import type {
  ContactFieldDef,
  CustomFieldValues,
  FieldType,
  FieldValue,
} from "./types";

export type CoercionResult =
  | { ok: true; value: FieldValue }
  | { ok: false; reason: CoercionError };

export type CoercionError =
  | "wrong_type"
  | "out_of_options"
  | "invalid_date"
  | "invalid_number";

/**
 * Coerce raw input (form / JSON) to the def's declared type.
 * Empty string / undefined / null all return `{ ok: true, value: null }`
 * — semantically "the user cleared this field." Required-field
 * enforcement is in validateValues, not here.
 */
export function coerceFieldValue(
  def: Pick<ContactFieldDef, "fieldType" | "options">,
  raw: unknown,
): CoercionResult {
  if (raw === null || raw === undefined || raw === "") {
    return { ok: true, value: null };
  }

  switch (def.fieldType) {
    case "text":
    case "longtext":
      if (typeof raw !== "string") {
        // Numbers / booleans coerce to string with String() — that's
        // surprising for users; reject instead.
        return { ok: false, reason: "wrong_type" };
      }
      return { ok: true, value: raw };

    case "number": {
      const n = typeof raw === "number" ? raw : Number(raw);
      if (!Number.isFinite(n)) return { ok: false, reason: "invalid_number" };
      return { ok: true, value: n };
    }

    case "boolean":
      if (typeof raw === "boolean") return { ok: true, value: raw };
      if (raw === "true") return { ok: true, value: true };
      if (raw === "false") return { ok: true, value: false };
      return { ok: false, reason: "wrong_type" };

    case "date": {
      // Accept ISO 8601 (with time) or YYYY-MM-DD. Reject anything
      // else so we don't silently mutate "next Tuesday" into NaN.
      if (typeof raw !== "string") return { ok: false, reason: "wrong_type" };
      const trimmed = raw.trim();
      if (!/^\d{4}-\d{2}-\d{2}(T.*)?$/.test(trimmed)) {
        return { ok: false, reason: "invalid_date" };
      }
      const ms = Date.parse(trimmed);
      if (!Number.isFinite(ms)) return { ok: false, reason: "invalid_date" };
      // Normalize to YYYY-MM-DD for date-only fields, ISO for datetime.
      return { ok: true, value: trimmed.length === 10 ? trimmed : new Date(ms).toISOString() };
    }

    case "select": {
      if (typeof raw !== "string") return { ok: false, reason: "wrong_type" };
      const allowed = new Set(def.options.map((o) => o.value));
      if (!allowed.has(raw)) return { ok: false, reason: "out_of_options" };
      return { ok: true, value: raw };
    }

    case "multiselect": {
      if (!Array.isArray(raw)) return { ok: false, reason: "wrong_type" };
      const allowed = new Set(def.options.map((o) => o.value));
      const out: string[] = [];
      const seen = new Set<string>();
      for (const item of raw) {
        if (typeof item !== "string") return { ok: false, reason: "wrong_type" };
        if (!allowed.has(item)) return { ok: false, reason: "out_of_options" };
        if (seen.has(item)) continue; // dedupe
        seen.add(item);
        out.push(item);
      }
      return { ok: true, value: out };
    }
  }
}

export type ValidationResult = {
  ok: boolean;
  /** field_key → error code. Empty when ok=true. */
  errors: Record<string, CoercionError | "required_missing" | "unknown_field">;
  /** Coerced values keyed by field_key. Only populated for fields
   *  that successfully coerced — invalid fields are dropped from
   *  this map AND surface in errors. Use this to write back to
   *  contacts.custom_fields after a successful overall check. */
  coerced: CustomFieldValues;
};

/**
 * Validate a full set of inbound values against the agent's
 * definitions. Returns coerced values + per-field errors.
 *
 * Behavior:
 *   - Unknown field keys (not in defs) flagged as 'unknown_field'.
 *     Defensive: prevents typos from silently writing data nobody
 *     can read back
 *   - Required fields missing OR null flagged as 'required_missing'
 *   - Type-coercion failures pass through CoercionError codes
 *   - Successfully coerced values land in `coerced` regardless of
 *     other fields' errors (caller can do partial saves)
 */
export function validateValues(
  defs: ReadonlyArray<ContactFieldDef>,
  values: Record<string, unknown>,
): ValidationResult {
  const errors: ValidationResult["errors"] = {};
  const coerced: CustomFieldValues = {};
  const defsByKey = new Map(defs.map((d) => [d.fieldKey, d]));
  const inputKeys = Object.keys(values);

  // Coerce each provided value.
  for (const key of inputKeys) {
    const def = defsByKey.get(key);
    if (!def) {
      errors[key] = "unknown_field";
      continue;
    }
    const result = coerceFieldValue(def, values[key]);
    if (result.ok) {
      coerced[key] = result.value;
    } else {
      // tsconfig.strict:false — discriminated union narrowing
      // doesn't kick in. Cast to the failure half explicitly.
      const failure = result as Extract<typeof result, { ok: false }>;
      errors[key] = failure.reason;
    }
  }

  // Required check: every required def must have a non-null value
  // (either freshly-coerced from input, or absent → flag missing).
  for (const def of defs) {
    if (!def.isRequired) continue;
    const inMap = def.fieldKey in coerced;
    const value = coerced[def.fieldKey];
    const isEmpty =
      !inMap ||
      value === null ||
      (typeof value === "string" && value.trim() === "") ||
      (Array.isArray(value) && value.length === 0);
    if (isEmpty) {
      errors[def.fieldKey] = "required_missing";
    }
  }

  return {
    ok: Object.keys(errors).length === 0,
    errors,
    coerced,
  };
}

/**
 * Decide whether two value sets are equal — used by callers that
 * want to skip writes when nothing changed.
 */
export function valuesEqual(
  a: CustomFieldValues,
  b: CustomFieldValues,
): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const k of aKeys) {
    if (!singleValueEqual(a[k], b[k])) return false;
  }
  return true;
}

function singleValueEqual(x: FieldValue, y: FieldValue): boolean {
  if (Array.isArray(x) && Array.isArray(y)) {
    if (x.length !== y.length) return false;
    return x.every((v, i) => v === y[i]);
  }
  return x === y;
}

/**
 * Drop values whose keys aren't in the def list. Useful when an
 * agent deletes a field def — existing contacts may still have
 * stale data; this helper sanitizes on read.
 */
export function pruneOrphanValues(
  defs: ReadonlyArray<ContactFieldDef>,
  values: CustomFieldValues,
): CustomFieldValues {
  const allowed = new Set(defs.map((d) => d.fieldKey));
  const out: CustomFieldValues = {};
  for (const [k, v] of Object.entries(values)) {
    if (allowed.has(k)) out[k] = v;
  }
  return out;
}

/** Validate that a field_key is well-formed (snake_case, no spaces). */
export function isValidFieldKey(key: string): boolean {
  return /^[a-z][a-z0-9_]{0,49}$/.test(key);
}

/** Field type the def can hold — round-trip helper for the UI. */
export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: "Text (single line)",
  longtext: "Text (multi-line)",
  number: "Number",
  boolean: "Yes / No",
  date: "Date",
  select: "Single choice",
  multiselect: "Multiple choice",
};
