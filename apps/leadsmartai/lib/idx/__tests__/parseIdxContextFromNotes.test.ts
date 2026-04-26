import { describe, expect, it } from "vitest";

import { parseIdxContextFromNotes } from "@/lib/followUp";

describe("parseIdxContextFromNotes", () => {
  it("returns null for null/empty input", () => {
    expect(parseIdxContextFromNotes(null)).toBeNull();
    expect(parseIdxContextFromNotes(undefined)).toBeNull();
    expect(parseIdxContextFromNotes("")).toBeNull();
  });

  it("returns null for plain-text non-JSON notes (legacy contacts)", () => {
    expect(parseIdxContextFromNotes("Met at open house, follow up next week.")).toBeNull();
  });

  it("returns null when JSON has no idx_action discriminator", () => {
    const notes = JSON.stringify({ foo: "bar", listing_id: "x" });
    expect(parseIdxContextFromNotes(notes)).toBeNull();
  });

  it("parses a full IDX favorite payload", () => {
    const notes = JSON.stringify({
      idx_action: "favorite",
      listing_id: "abc123",
      listing_address: "123 Main St, San Francisco, CA",
      listing_price: 1250000,
      search_filters: { city: "San Francisco", state: "CA" },
    });
    expect(parseIdxContextFromNotes(notes)).toEqual({
      action: "favorite",
      listingId: "abc123",
      listingAddress: "123 Main St, San Francisco, CA",
      listingPrice: 1250000,
      searchFilters: { city: "San Francisco", state: "CA" },
    });
  });

  it("parses a save_search payload with no listing", () => {
    const notes = JSON.stringify({
      idx_action: "save_search",
      listing_id: null,
      listing_address: null,
      listing_price: null,
      search_filters: { city: "Austin", state: "TX", priceMax: 800000 },
    });
    const out = parseIdxContextFromNotes(notes);
    expect(out?.action).toBe("save_search");
    expect(out?.listingId).toBeNull();
    expect(out?.searchFilters).toEqual({ city: "Austin", state: "TX", priceMax: 800000 });
  });

  it("coerces unexpected types gracefully (defensive)", () => {
    const notes = JSON.stringify({
      idx_action: "favorite",
      listing_id: 123, // non-string — should become null
      listing_address: 456, // non-string — should become null
      listing_price: "not-a-number", // non-number — should become null
      search_filters: "not-an-object", // non-object — should become null
    });
    const out = parseIdxContextFromNotes(notes);
    expect(out?.action).toBe("favorite");
    expect(out?.listingId).toBeNull();
    expect(out?.listingAddress).toBeNull();
    expect(out?.listingPrice).toBeNull();
    expect(out?.searchFilters).toBeNull();
  });

  it("never throws on malformed JSON", () => {
    expect(() => parseIdxContextFromNotes("{not json")).not.toThrow();
    expect(parseIdxContextFromNotes("{not json")).toBeNull();
  });
});
