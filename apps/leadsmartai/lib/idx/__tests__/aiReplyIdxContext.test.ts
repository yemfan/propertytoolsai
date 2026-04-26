import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { fmtIdxLine, generateReply, type IdxReplyContext } from "@/lib/aiReplyGenerator";

describe("fmtIdxLine", () => {
  it("returns null for null/undefined/empty inputs", () => {
    expect(fmtIdxLine(null)).toBeNull();
    expect(fmtIdxLine(undefined)).toBeNull();
    expect(fmtIdxLine({})).toBeNull();
  });

  it("renders address + price for favorite action", () => {
    const out = fmtIdxLine({
      action: "favorite",
      listingAddress: "123 Main St",
      listingPrice: 850000,
    });
    expect(out).toContain("123 Main St");
    expect(out).toContain("$850,000");
    expect(out).toMatch(/saved this home as a favorite/i);
  });

  it("renders address-only when price is missing", () => {
    const out = fmtIdxLine({ action: "schedule_tour", listingAddress: "456 Oak Ave" });
    expect(out).toContain("456 Oak Ave");
    expect(out).toMatch(/requested a tour/i);
    expect(out).not.toContain("$");
  });

  it("renders search filters when no listing address is present", () => {
    const out = fmtIdxLine({
      action: "save_search",
      searchFilters: { city: "Austin", state: "TX", priceMax: 800000, bedsMin: 3 },
    });
    expect(out).toContain("Austin");
    expect(out).toContain("TX");
    expect(out).toContain("3+ beds");
    expect(out).toContain("$800,000");
    expect(out).toMatch(/saved a search/i);
  });

  it("renders generic action line when neither listing nor filters are present", () => {
    const out = fmtIdxLine({ action: "view_threshold" });
    expect(out).toMatch(/browsed multiple listings/i);
  });

  it("ignores unknown actions but still surfaces the listing", () => {
    const out = fmtIdxLine({ action: "weird_action", listingAddress: "789 Pine Rd" });
    expect(out).toContain("789 Pine Rd");
    // No phrase from action mapping, so should fall through to "interested in"
    expect(out).toMatch(/interested in/i);
  });
});

describe("generateReply fallback (no OpenAI key) — IDX branches", () => {
  const originalKey = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    delete process.env.OPENAI_API_KEY;
  });

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = originalKey;
    }
  });

  it("uses tour-specific copy when action is schedule_tour", async () => {
    const idx: IdxReplyContext = {
      action: "schedule_tour",
      listingAddress: "100 Elm St",
      listingPrice: 999000,
    };
    const reply = await generateReply({
      lead: { name: "Sarah" },
      messages: [],
      idx,
    });
    expect(reply).toContain("Sarah");
    expect(reply).toContain("100 Elm St");
    expect(reply).toMatch(/tour/i);
  });

  it("uses favorite-specific copy when action is favorite", async () => {
    const reply = await generateReply({
      lead: { name: "Sam" },
      messages: [],
      idx: { action: "favorite", listingAddress: "200 Maple Ln" },
    });
    expect(reply).toContain("Sam");
    expect(reply).toContain("200 Maple Ln");
    expect(reply).toMatch(/saved/i);
  });

  it("falls back to generic outreach for non-IDX leads", async () => {
    const reply = await generateReply({
      lead: { name: "Jordan", property_address: "Downtown" },
      messages: [],
    });
    expect(reply).toContain("Jordan");
    expect(reply).toContain("Downtown");
    // No IDX-specific phrasing
    expect(reply).not.toMatch(/saved this home as a favorite/i);
    expect(reply).not.toMatch(/asking about a tour at/i);
  });

  it("uses listing address from idx context over plain property_address when both present", async () => {
    const reply = await generateReply({
      lead: { name: "Alex", property_address: "old address" },
      messages: [],
      idx: { action: "favorite", listingAddress: "current address" },
    });
    expect(reply).toContain("current address");
    expect(reply).not.toContain("old address");
  });
});
