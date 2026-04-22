import { describe, expect, it, vi } from "vitest";

// generateCommentary.ts imports `server-only` + `@/lib/anthropic` at the
// top. Stub both so the module loads in plain-node vitest.
vi.mock("server-only", () => ({}));
vi.mock("@/lib/anthropic", () => ({
  getAnthropicClient: () => {
    throw new Error("should not be called in parser tests");
  },
}));

// eslint-disable-next-line import/first
import { renderSellerUpdateEmail } from "../renderEmail";
// eslint-disable-next-line import/first
import type { ListingActivitySnapshot, SellerCommentary, VisitorTimeline } from "../types";
// eslint-disable-next-line import/first
import { parseCommentaryResponse } from "../generateCommentary";

function snapshot(overrides: Partial<ListingActivitySnapshot> = {}): ListingActivitySnapshot {
  return {
    propertyAddress: "500 Sutter St, San Francisco, CA",
    listPrice: 1_250_000,
    listingStartDate: "2026-04-01",
    daysOnMarket: 14,
    windowStartIso: "2026-04-08T00:00:00Z",
    windowEndIso: "2026-04-15T00:00:00Z",
    openHousesHeldCount: 2,
    visitorsTotal: 8,
    visitorsHot: 2,
    visitorsAgented: 3,
    visitorsOptedIn: 5,
    visitorTimelineBreakdown: {
      now: 2,
      "3_6_months": 3,
      "6_12_months": 2,
      later: 1,
      just_looking: 0,
    },
    visitorNoteSnippets: [],
    offersReceivedCount: 1,
    offersActiveCount: 1,
    offersAcceptedCount: 0,
    offersRejectedCount: 0,
    offerPriceRange: { min: 1_200_000, max: 1_200_000 },
    lifetimeVisitors: 17,
    lifetimeOffers: 1,
    ...overrides,
  };
}

function commentary(overrides: Partial<SellerCommentary> = {}): SellerCommentary {
  return {
    summary: "Steady activity this week — 8 visitors and 1 offer.",
    observations: [
      "2 visitors were actively looking to buy now.",
      "The one offer came in at $50k under list.",
    ],
    recommendation: "Let's talk Monday about whether to counter or wait.",
    suggestsPriceReduction: false,
    ...overrides,
  };
}

describe("renderSellerUpdateEmail", () => {
  it("subject flips when a price reduction is recommended", () => {
    const out = renderSellerUpdateEmail({
      activity: snapshot(),
      commentary: commentary({ suggestsPriceReduction: true }),
      sellerFirstName: "Pat",
      agentName: null,
      agentBrokerage: null,
    });
    expect(out.subject).toMatch(/pricing/i);
  });

  it("subject mentions offer count when offers received", () => {
    const out = renderSellerUpdateEmail({
      activity: snapshot({ offersReceivedCount: 3 }),
      commentary: commentary(),
      sellerFirstName: null,
      agentName: null,
      agentBrokerage: null,
    });
    expect(out.subject).toMatch(/3 offers in/i);
  });

  it("falls back to plain subject when quiet + no price rec", () => {
    const out = renderSellerUpdateEmail({
      activity: snapshot({ offersReceivedCount: 0, visitorsTotal: 0 }),
      commentary: commentary({ suggestsPriceReduction: false }),
      sellerFirstName: null,
      agentName: null,
      agentBrokerage: null,
    });
    expect(out.subject).not.toMatch(/pricing|offer/i);
  });

  it("renders days on market when listing_start_date is present", () => {
    const out = renderSellerUpdateEmail({
      activity: snapshot({ daysOnMarket: 21 }),
      commentary: commentary(),
      sellerFirstName: null,
      agentName: null,
      agentBrokerage: null,
    });
    expect(out.html).toMatch(/21 days on market/);
    expect(out.text).toMatch(/21 days on market/);
  });

  it("omits offer range when no offers in window", () => {
    // Need a dollar-free commentary so the test's absence assertion is
    // scoped to the stats area, not the (correctly-rendered) commentary.
    const out = renderSellerUpdateEmail({
      activity: snapshot({ offersReceivedCount: 0, offerPriceRange: null }),
      commentary: commentary({
        summary: "Quiet week.",
        observations: ["No visitors, no offers."],
        recommendation: "Let's discuss marketing.",
      }),
      sellerFirstName: null,
      agentName: null,
      agentBrokerage: null,
    });
    // The "Offer range" stat row only renders when offerPriceRange is set;
    // assert the label doesn't appear.
    expect(out.html).not.toMatch(/Offer range/i);
    expect(out.html).not.toMatch(/\$\d/);
  });

  it("uses an inclusive range when multiple offer prices", () => {
    const out = renderSellerUpdateEmail({
      activity: snapshot({
        offersReceivedCount: 3,
        offerPriceRange: { min: 1_150_000, max: 1_260_000 },
      }),
      commentary: commentary(),
      sellerFirstName: null,
      agentName: null,
      agentBrokerage: null,
    });
    expect(out.html).toMatch(/\$1,150,000/);
    expect(out.html).toMatch(/\$1,260,000/);
  });

  it("escapes HTML in property address + commentary", () => {
    const out = renderSellerUpdateEmail({
      activity: snapshot({ propertyAddress: "<script>x</script> 99 Oak" }),
      commentary: commentary({
        summary: "Tom & Jane's feedback was harsh.",
      }),
      sellerFirstName: null,
      agentName: null,
      agentBrokerage: null,
    });
    expect(out.html).not.toContain("<script>x</script>");
    expect(out.html).toContain("&lt;script&gt;");
    expect(out.html).toContain("Tom &amp; Jane");
  });

  it("shows the visitor-timeline breakdown when there are visitors", () => {
    const out = renderSellerUpdateEmail({
      activity: snapshot(),
      commentary: commentary(),
      sellerFirstName: null,
      agentName: null,
      agentBrokerage: null,
    });
    expect(out.html).toMatch(/Ready now/);
    expect(out.html).toMatch(/3-6 months/);
  });

  it("hides the timeline breakdown when visitors = 0", () => {
    const breakdown: Record<VisitorTimeline, number> = {
      now: 0,
      "3_6_months": 0,
      "6_12_months": 0,
      later: 0,
      just_looking: 0,
    };
    const out = renderSellerUpdateEmail({
      activity: snapshot({ visitorsTotal: 0, visitorTimelineBreakdown: breakdown }),
      commentary: commentary(),
      sellerFirstName: null,
      agentName: null,
      agentBrokerage: null,
    });
    expect(out.html).not.toMatch(/Visitor buying timeline/);
  });

  it("includes agent signature when provided", () => {
    const out = renderSellerUpdateEmail({
      activity: snapshot(),
      commentary: commentary(),
      sellerFirstName: "Pat",
      agentName: "Alex Agent",
      agentBrokerage: "Great Brokerage",
    });
    expect(out.html).toMatch(/Alex Agent, Great Brokerage/);
  });
});

describe("parseCommentaryResponse", () => {
  it("parses a clean JSON response with all fields", () => {
    const raw = JSON.stringify({
      summary: "Summary here.",
      observations: ["One.", "Two."],
      recommendation: "Do this.",
      suggestsPriceReduction: true,
    });
    const out = parseCommentaryResponse(raw);
    expect(out.summary).toBe("Summary here.");
    expect(out.observations).toHaveLength(2);
    expect(out.suggestsPriceReduction).toBe(true);
  });

  it("strips markdown fences", () => {
    const raw = "```json\n" +
      JSON.stringify({
        summary: "x",
        observations: ["one"],
        recommendation: "y",
        suggestsPriceReduction: false,
      }) +
      "\n```";
    const out = parseCommentaryResponse(raw);
    expect(out.summary).toBe("x");
  });

  it("coerces missing fields to safe empties rather than crashing", () => {
    const out = parseCommentaryResponse("{}");
    expect(out.summary).toBe("");
    expect(out.observations).toEqual([]);
    expect(out.recommendation).toBe("");
    expect(out.suggestsPriceReduction).toBe(false);
  });

  it("caps observations at 3", () => {
    const raw = JSON.stringify({
      summary: "x",
      observations: ["1", "2", "3", "4", "5"],
      recommendation: "y",
      suggestsPriceReduction: false,
    });
    const out = parseCommentaryResponse(raw);
    expect(out.observations).toHaveLength(3);
  });

  it("throws on invalid JSON", () => {
    expect(() => parseCommentaryResponse("not json")).toThrowError(/valid JSON/i);
  });
});
