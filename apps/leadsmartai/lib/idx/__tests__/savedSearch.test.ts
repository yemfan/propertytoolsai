import { describe, expect, it } from "vitest";

import {
  buildSavedSearchName,
  idxFiltersToSavedSearchCriteria,
} from "@/lib/idx/savedSearch";

describe("idxFiltersToSavedSearchCriteria", () => {
  it("returns empty object for null/undefined", () => {
    expect(idxFiltersToSavedSearchCriteria(null)).toEqual({});
    expect(idxFiltersToSavedSearchCriteria(undefined)).toEqual({});
    expect(idxFiltersToSavedSearchCriteria({})).toEqual({});
  });

  it("maps the common fields one-for-one", () => {
    const out = idxFiltersToSavedSearchCriteria({
      city: "Austin",
      state: "TX",
      zip: "78701",
      propertyType: "single_family",
      priceMin: 500000,
      priceMax: 800000,
      bedsMin: 3,
      bathsMin: 2,
      sqftMin: 1500,
    });
    expect(out).toEqual({
      city: "Austin",
      state: "TX",
      zip: "78701",
      propertyType: "single_family",
      priceMin: 500000,
      priceMax: 800000,
      bedsMin: 3,
      bathsMin: 2,
      sqftMin: 1500,
    });
  });

  it("collapses IDX-only property types (land/other) to 'any' so the alert never excludes everything", () => {
    expect(idxFiltersToSavedSearchCriteria({ propertyType: "land" }).propertyType).toBe("any");
    expect(idxFiltersToSavedSearchCriteria({ propertyType: "other" }).propertyType).toBe("any");
  });

  it("ignores unknown property types entirely", () => {
    const out = idxFiltersToSavedSearchCriteria({ propertyType: "warehouse" });
    expect(out.propertyType).toBeUndefined();
  });

  it("coerces numeric strings into numbers", () => {
    const out = idxFiltersToSavedSearchCriteria({
      priceMin: "500000",
      bedsMin: "3",
    });
    expect(out.priceMin).toBe(500000);
    expect(out.bedsMin).toBe(3);
  });

  it("ignores non-finite or empty values", () => {
    const out = idxFiltersToSavedSearchCriteria({
      city: "  ",
      priceMin: "",
      priceMax: NaN,
    });
    expect(out.city).toBeUndefined();
    expect(out.priceMin).toBeUndefined();
    expect(out.priceMax).toBeUndefined();
  });
});

describe("buildSavedSearchName", () => {
  it("uses 'City, State' when both provided", () => {
    const name = buildSavedSearchName({ city: "Austin", state: "TX" });
    expect(name).toBe("Homes in Austin, TX");
  });

  it("falls back to ZIP when no city/state", () => {
    expect(buildSavedSearchName({ zip: "78701" })).toBe("Homes in 78701");
  });

  it("falls back to 'your area' when nothing is set", () => {
    expect(buildSavedSearchName({})).toBe("Homes in your area");
  });

  it("appends an 'under $X' price clause", () => {
    expect(buildSavedSearchName({ city: "Austin", state: "TX", priceMax: 800000 }))
      .toBe("Homes in Austin, TX · under $800,000");
  });

  it("appends an 'over $X' clause when only priceMin is set", () => {
    expect(buildSavedSearchName({ city: "Austin", priceMin: 500000 }))
      .toBe("Homes in Austin · over $500,000");
  });

  it("includes beds + property type", () => {
    const name = buildSavedSearchName({
      city: "Austin",
      state: "TX",
      bedsMin: 3,
      propertyType: "single_family",
    });
    expect(name).toContain("3+ beds");
    expect(name).toContain("single family");
  });

  it("omits 'any' property type", () => {
    const name = buildSavedSearchName({ city: "Austin", propertyType: "any" });
    expect(name).not.toContain("any");
  });

  it("caps the name at 120 chars", () => {
    const name = buildSavedSearchName({
      city: "Very".repeat(50),
      state: "TX",
      priceMax: 1000000,
    });
    expect(name.length).toBeLessThanOrEqual(120);
  });
});
