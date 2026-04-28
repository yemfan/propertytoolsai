import { describe, expect, it } from "vitest";

import {
  buildListingCaption,
  type ListingCaptionInput,
} from "@/lib/social/captionBuilder";

function input(overrides: Partial<ListingCaptionInput> = {}): ListingCaptionInput {
  return {
    propertyAddress: "123 Main St",
    city: "Austin",
    state: "TX",
    beds: 3,
    baths: 2,
    sqft: 1800,
    listPrice: 525_000,
    agentName: "Sam Reynolds",
    agentBrokerage: "Pacific Realty",
    ...overrides,
  };
}

describe("buildListingCaption — happy path", () => {
  it("builds a multi-line caption with all fields populated", () => {
    const out = buildListingCaption(input());
    expect(out.caption).toContain("Just listed! 123 Main St — Austin, TX");
    expect(out.caption).toContain("• 3 bed | 2 bath | 1,800 sqft");
    expect(out.caption).toContain("• Listed at $525,000");
    expect(out.caption).toContain("— Sam Reynolds at Pacific Realty");
    expect(out.caption).toContain("#realestate");
    expect(out.caption).toContain("#austin");
    expect(out.caption).toContain("#tx");
  });

  it("uses the supplied hook when provided", () => {
    const out = buildListingCaption(input({ hook: "Open this Saturday!" }));
    expect(out.caption.startsWith("Open this Saturday! 123 Main St")).toBe(true);
  });

  it("falls back to default hook when whitespace-only", () => {
    const out = buildListingCaption(input({ hook: "   " }));
    expect(out.caption.startsWith("Just listed!")).toBe(true);
  });
});

describe("buildListingCaption — location suffix", () => {
  it("renders city + state when both present", () => {
    const out = buildListingCaption(input({ city: "Austin", state: "TX" }));
    expect(out.caption).toContain("Austin, TX");
  });

  it("renders only city when state is missing", () => {
    const out = buildListingCaption(input({ city: "Austin", state: null }));
    expect(out.caption).toContain("123 Main St — Austin");
    expect(out.caption).not.toContain("Austin,");
  });

  it("renders only state when city is missing", () => {
    const out = buildListingCaption(input({ city: null, state: "TX" }));
    expect(out.caption).toContain("123 Main St — TX");
  });

  it("drops the entire suffix when both are missing", () => {
    const out = buildListingCaption(input({ city: null, state: null }));
    expect(out.caption.split("\n")[0]).toBe("Just listed! 123 Main St");
  });
});

describe("buildListingCaption — details bullet", () => {
  it("collapses missing fields cleanly", () => {
    const out = buildListingCaption(input({ beds: 3, baths: null, sqft: null }));
    expect(out.caption).toContain("• 3 bed");
    expect(out.caption).not.toContain("| bath");
    expect(out.caption).not.toContain("sqft");
  });

  it("drops the details bullet when no detail field is present", () => {
    const out = buildListingCaption(input({ beds: null, baths: null, sqft: null }));
    // No "bed | bath | sqft" line. The price line starts with `• ` too,
    // so we check specifically for the details-shape pattern, not any
    // bullet line.
    expect(out.caption).not.toMatch(/^•\s.*(bed|bath|sqft)/m);
  });

  it("drops zero / negative numbers (stub data)", () => {
    const out = buildListingCaption(input({ beds: 0, baths: -1, sqft: 0 }));
    expect(out.caption).not.toContain("0 bed");
    expect(out.caption).not.toContain("-1 bath");
    expect(out.caption).not.toContain("0 sqft");
  });

  it("formats sqft with thousands separators", () => {
    const out = buildListingCaption(input({ sqft: 12_500 }));
    expect(out.caption).toContain("12,500 sqft");
  });
});

describe("buildListingCaption — price", () => {
  it("formats USD with no decimal places", () => {
    const out = buildListingCaption(input({ listPrice: 1_250_000 }));
    expect(out.caption).toContain("Listed at $1,250,000");
  });

  it("drops the price line entirely when missing", () => {
    const out = buildListingCaption(input({ listPrice: null }));
    expect(out.caption).not.toContain("Listed at");
  });

  it("drops zero price (stub data)", () => {
    const out = buildListingCaption(input({ listPrice: 0 }));
    expect(out.caption).not.toContain("Listed at");
  });
});

describe("buildListingCaption — sign-off", () => {
  it("uses 'name at brokerage' when both present", () => {
    const out = buildListingCaption(input({ agentName: "Sam", agentBrokerage: "Pacific" }));
    expect(out.caption).toContain("— Sam at Pacific");
  });

  it("falls back to name only", () => {
    const out = buildListingCaption(input({ agentName: "Sam", agentBrokerage: null }));
    expect(out.caption).toContain("— Sam");
    expect(out.caption).not.toContain("— Sam at");
  });

  it("falls back to brokerage only", () => {
    const out = buildListingCaption(input({ agentName: null, agentBrokerage: "Pacific" }));
    expect(out.caption).toContain("— Pacific");
  });

  it("drops the sign-off when both missing", () => {
    const out = buildListingCaption(input({ agentName: null, agentBrokerage: null }));
    // The address line uses an em-dash separator between address and
    // city, so we check specifically for the "— Name" sign-off shape.
    expect(out.caption).not.toMatch(/^—\s/m);
  });
});

describe("buildListingCaption — hashtags", () => {
  it("always includes #realestate", () => {
    const out = buildListingCaption(input({ city: null, state: null }));
    expect(out.hashtags).toEqual(["realestate"]);
  });

  it("sanitizes city to alphanumeric lowercase", () => {
    const out = buildListingCaption(input({ city: "St. Louis", state: "MO" }));
    expect(out.hashtags).toEqual(["realestate", "stlouis", "mo"]);
    expect(out.caption).toContain("#stlouis");
  });

  it("strips spaces in multi-word cities", () => {
    const out = buildListingCaption(input({ city: "San Francisco", state: "CA" }));
    expect(out.hashtags).toContain("sanfrancisco");
  });

  it("drops empty/whitespace tags", () => {
    const out = buildListingCaption(input({ city: "   ", state: "" }));
    expect(out.hashtags).toEqual(["realestate"]);
  });
});

describe("buildListingCaption — length cap", () => {
  it("truncates with ellipsis when caption exceeds 1500 chars", () => {
    const longHook = "x".repeat(2000);
    const out = buildListingCaption(input({ hook: longHook }));
    expect(out.caption.length).toBeLessThanOrEqual(1500);
    expect(out.caption.endsWith("…")).toBe(true);
  });
});
