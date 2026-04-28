import { describe, expect, it } from "vitest";
import type { ContactFieldDef, FieldType } from "../types";
import {
  coerceFieldValue,
  isValidFieldKey,
  pruneOrphanValues,
  validateValues,
  valuesEqual,
} from "../values";

function def(
  overrides: Partial<ContactFieldDef> & { fieldType: FieldType; fieldKey: string },
): ContactFieldDef {
  return {
    id: `def-${overrides.fieldKey}`,
    agentId: "agent-1",
    label: overrides.fieldKey,
    options: [],
    isRequired: false,
    sortOrder: 0,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("coerceFieldValue — empty input", () => {
  const textDef = def({ fieldType: "text", fieldKey: "x" });
  it("treats null/undefined/empty string as 'cleared' (returns null)", () => {
    expect(coerceFieldValue(textDef, null)).toEqual({ ok: true, value: null });
    expect(coerceFieldValue(textDef, undefined)).toEqual({ ok: true, value: null });
    expect(coerceFieldValue(textDef, "")).toEqual({ ok: true, value: null });
  });
});

describe("coerceFieldValue — text / longtext", () => {
  it("accepts strings", () => {
    expect(coerceFieldValue(def({ fieldType: "text", fieldKey: "x" }), "hello")).toEqual({
      ok: true,
      value: "hello",
    });
  });
  it("rejects non-strings (no silent String(n) coercion)", () => {
    expect(coerceFieldValue(def({ fieldType: "text", fieldKey: "x" }), 42).ok).toBe(false);
    expect(coerceFieldValue(def({ fieldType: "longtext", fieldKey: "x" }), true).ok).toBe(false);
  });
});

describe("coerceFieldValue — number", () => {
  const d = def({ fieldType: "number", fieldKey: "x" });
  it("accepts numbers", () => {
    expect(coerceFieldValue(d, 42)).toEqual({ ok: true, value: 42 });
  });
  it("parses numeric strings", () => {
    expect(coerceFieldValue(d, "42.5")).toEqual({ ok: true, value: 42.5 });
  });
  it("rejects non-numeric strings with invalid_number", () => {
    const out = coerceFieldValue(d, "not a number");
    expect(out).toEqual({ ok: false, reason: "invalid_number" });
  });
});

describe("coerceFieldValue — boolean", () => {
  const d = def({ fieldType: "boolean", fieldKey: "x" });
  it("accepts true / false directly", () => {
    expect(coerceFieldValue(d, true)).toEqual({ ok: true, value: true });
    expect(coerceFieldValue(d, false)).toEqual({ ok: true, value: false });
  });
  it("accepts 'true' / 'false' strings (form input)", () => {
    expect(coerceFieldValue(d, "true")).toEqual({ ok: true, value: true });
    expect(coerceFieldValue(d, "false")).toEqual({ ok: true, value: false });
  });
  it("rejects other strings", () => {
    expect(coerceFieldValue(d, "yes").ok).toBe(false);
    expect(coerceFieldValue(d, 1).ok).toBe(false);
  });
});

describe("coerceFieldValue — date", () => {
  const d = def({ fieldType: "date", fieldKey: "x" });
  it("accepts YYYY-MM-DD", () => {
    expect(coerceFieldValue(d, "2026-04-28")).toEqual({ ok: true, value: "2026-04-28" });
  });
  it("normalizes ISO datetimes through Date.parse", () => {
    const out = coerceFieldValue(d, "2026-04-28T12:00:00Z");
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.value).toMatch(/^2026-04-28T/);
    }
  });
  it("rejects free-form text with invalid_date", () => {
    expect(coerceFieldValue(d, "next Tuesday")).toEqual({ ok: false, reason: "invalid_date" });
  });
});

describe("coerceFieldValue — select / multiselect", () => {
  const d = def({
    fieldType: "select",
    fieldKey: "x",
    options: [
      { value: "a", label: "A" },
      { value: "b", label: "B" },
    ],
  });
  it("accepts an in-options value", () => {
    expect(coerceFieldValue(d, "a")).toEqual({ ok: true, value: "a" });
  });
  it("rejects out-of-options with out_of_options", () => {
    expect(coerceFieldValue(d, "c")).toEqual({ ok: false, reason: "out_of_options" });
  });

  const mD = def({
    fieldType: "multiselect",
    fieldKey: "x",
    options: [
      { value: "x", label: "X" },
      { value: "y", label: "Y" },
    ],
  });
  it("accepts arrays of in-options values", () => {
    expect(coerceFieldValue(mD, ["x", "y"])).toEqual({ ok: true, value: ["x", "y"] });
  });
  it("dedupes multiselect values", () => {
    expect(coerceFieldValue(mD, ["x", "x", "y"])).toEqual({ ok: true, value: ["x", "y"] });
  });
  it("rejects multiselect with out-of-options entry", () => {
    expect(coerceFieldValue(mD, ["x", "z"]).ok).toBe(false);
  });
  it("rejects non-array input for multiselect", () => {
    expect(coerceFieldValue(mD, "x").ok).toBe(false);
  });
});

describe("validateValues", () => {
  const defs: ContactFieldDef[] = [
    def({ fieldKey: "budget", fieldType: "number" }),
    def({ fieldKey: "tier", fieldType: "select", options: [{ value: "a", label: "A" }] }),
    def({ fieldKey: "phone", fieldType: "text", isRequired: true }),
  ];

  it("flags unknown field keys", () => {
    const r = validateValues(defs, { random_field: "x" });
    expect(r.errors.random_field).toBe("unknown_field");
  });

  it("flags missing required fields", () => {
    const r = validateValues(defs, {});
    expect(r.errors.phone).toBe("required_missing");
  });

  it("flags required field that's whitespace-only", () => {
    const r = validateValues(defs, { phone: "   " });
    // phone coerces fine to "   " but then required_missing fires
    // because trim is empty.
    expect(r.errors.phone).toBe("required_missing");
  });

  it("populates coerced map with successfully-typed values even when other fields fail", () => {
    const r = validateValues(defs, {
      budget: "850000",
      tier: "not-an-option",
      phone: "415-555-1212",
    });
    expect(r.coerced.budget).toBe(850000);
    expect(r.coerced.phone).toBe("415-555-1212");
    expect(r.errors.tier).toBe("out_of_options");
    expect(r.ok).toBe(false);
  });

  it("returns ok:true when everything coerces", () => {
    const r = validateValues(defs, {
      budget: 750000,
      tier: "a",
      phone: "415-555-1212",
    });
    expect(r).toEqual({
      ok: true,
      errors: {},
      coerced: { budget: 750000, tier: "a", phone: "415-555-1212" },
    });
  });
});

describe("valuesEqual", () => {
  it("returns true for identical scalars", () => {
    expect(valuesEqual({ a: 1, b: "x" }, { a: 1, b: "x" })).toBe(true);
  });
  it("returns false on different keys", () => {
    expect(valuesEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
  });
  it("compares array values element-by-element", () => {
    expect(valuesEqual({ tags: ["x", "y"] }, { tags: ["x", "y"] })).toBe(true);
    expect(valuesEqual({ tags: ["x", "y"] }, { tags: ["y", "x"] })).toBe(false);
  });
});

describe("pruneOrphanValues", () => {
  const defs: ContactFieldDef[] = [def({ fieldKey: "budget", fieldType: "number" })];
  it("drops keys not in the def list", () => {
    expect(pruneOrphanValues(defs, { budget: 1, deleted_field: "x" })).toEqual({
      budget: 1,
    });
  });
});

describe("isValidFieldKey", () => {
  it("accepts snake_case identifiers", () => {
    expect(isValidFieldKey("budget")).toBe(true);
    expect(isValidFieldKey("preferred_lender")).toBe(true);
    expect(isValidFieldKey("school_district_3")).toBe(true);
  });
  it("rejects bad inputs", () => {
    expect(isValidFieldKey("")).toBe(false);
    expect(isValidFieldKey("Budget")).toBe(false); // capital
    expect(isValidFieldKey("budget!")).toBe(false); // special char
    expect(isValidFieldKey("123_starts_with_digit")).toBe(false);
    expect(isValidFieldKey("has spaces")).toBe(false);
    expect(isValidFieldKey("a".repeat(51))).toBe(false); // too long
  });
});
