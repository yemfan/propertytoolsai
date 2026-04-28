import { describe, expect, it } from "vitest";
import {
  DEFAULT_SECTIONS,
  isPresentationReady,
  normalizeSections,
  SECTION_KINDS,
  type Section,
} from "../sections";

describe("DEFAULT_SECTIONS", () => {
  it("includes every SECTION_KINDS value", () => {
    const defaultTypes = new Set(DEFAULT_SECTIONS.map((s) => s.type));
    for (const k of SECTION_KINDS) {
      expect(defaultTypes.has(k)).toBe(true);
    }
  });

  it("starts with the cover slide", () => {
    expect(DEFAULT_SECTIONS[0].type).toBe("cover");
  });

  it("has every section enabled by default", () => {
    for (const s of DEFAULT_SECTIONS) expect(s.enabled).toBe(true);
  });
});

describe("normalizeSections", () => {
  it("returns an empty array on non-array input", () => {
    expect(normalizeSections(null)).toEqual([]);
    expect(normalizeSections(undefined)).toEqual([]);
    expect(normalizeSections("string")).toEqual([]);
    expect(normalizeSections({})).toEqual([]);
  });

  it("drops entries with unknown type", () => {
    const out = normalizeSections([
      { type: "cma", enabled: true },
      { type: "experimental_section", enabled: true },
      { type: "agent_bio", enabled: true },
    ]);
    expect(out.map((s) => s.type)).toEqual(["cma", "agent_bio"]);
  });

  it("dedupes by type, keeping the first occurrence (preserves order)", () => {
    const out = normalizeSections([
      { type: "cma", enabled: false },
      { type: "agent_bio", enabled: true },
      { type: "cma", enabled: true }, // dup — dropped
    ]);
    expect(out).toHaveLength(2);
    expect(out[0].type).toBe("cma");
    expect(out[0].enabled).toBe(false); // first wins
  });

  it("hoists cover to the front when present mid-array", () => {
    const out = normalizeSections([
      { type: "cma", enabled: true },
      { type: "cover", enabled: true },
      { type: "agent_bio", enabled: true },
    ]);
    expect(out[0].type).toBe("cover");
    expect(out.map((s) => s.type)).toEqual(["cover", "cma", "agent_bio"]);
  });

  it("defaults `enabled` to true when missing", () => {
    const out = normalizeSections([{ type: "cma" }]);
    expect(out[0].enabled).toBe(true);
  });

  it("preserves the config object when present", () => {
    const out = normalizeSections([
      { type: "cma", enabled: true, config: { featuredCompIds: ["a", "b"] } },
    ]);
    expect(out[0].config).toEqual({ featuredCompIds: ["a", "b"] });
  });

  it("drops entries that aren't objects (defensive)", () => {
    const out = normalizeSections([null, undefined, "cma", { type: "cma" }]);
    expect(out).toHaveLength(1);
  });
});

describe("isPresentationReady", () => {
  function ready(overrides: Partial<Parameters<typeof isPresentationReady>[0]> = {}) {
    return isPresentationReady({
      propertyAddress: "123 Main St",
      suggestedListPrice: 850000,
      sections: DEFAULT_SECTIONS,
      hasCmaData: true,
      hasTestimonials: true,
      ...overrides,
    });
  }

  it("returns ready when everything is in place", () => {
    expect(ready()).toEqual({ ready: true, missing: [] });
  });

  it("flags missing address", () => {
    expect(ready({ propertyAddress: "" }).missing).toContain("no_address");
    expect(ready({ propertyAddress: "  " }).missing).toContain("no_address");
  });

  it("flags missing list price", () => {
    expect(ready({ suggestedListPrice: null }).missing).toContain("no_list_price");
    expect(ready({ suggestedListPrice: NaN }).missing).toContain("no_list_price");
  });

  it("flags when no sections are enabled", () => {
    const allDisabled: Section[] = DEFAULT_SECTIONS.map((s) => ({ ...s, enabled: false }));
    expect(ready({ sections: allDisabled }).missing).toContain("no_sections_enabled");
  });

  it("flags when CMA section is enabled but no CMA data exists", () => {
    expect(ready({ hasCmaData: false }).missing).toContain("cma_enabled_but_empty");
  });

  it("does NOT flag empty CMA when CMA section is disabled", () => {
    const noCma: Section[] = DEFAULT_SECTIONS.map((s) =>
      s.type === "cma" ? { ...s, enabled: false } : s,
    );
    expect(ready({ sections: noCma, hasCmaData: false }).missing).not.toContain(
      "cma_enabled_but_empty",
    );
  });

  it("flags when testimonials section is enabled but library is empty", () => {
    expect(ready({ hasTestimonials: false }).missing).toContain(
      "testimonials_enabled_but_empty",
    );
  });

  it("returns multiple issues when several are wrong", () => {
    const r = ready({
      propertyAddress: "",
      suggestedListPrice: null,
      hasCmaData: false,
    });
    expect(r.ready).toBe(false);
    expect(r.missing).toContain("no_address");
    expect(r.missing).toContain("no_list_price");
    expect(r.missing).toContain("cma_enabled_but_empty");
  });
});
