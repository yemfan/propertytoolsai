import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/anthropic", () => ({
  getAnthropicClient: () => {
    throw new Error("should not be called in parser tests");
  },
}));

// eslint-disable-next-line import/first
import { parseOpportunitiesResponse } from "../generateOpportunities";

describe("parseOpportunitiesResponse", () => {
  const sample = JSON.stringify({
    opportunities: [
      {
        id: "stale-sphere-re-engage",
        priority: "high",
        category: "stale_sphere",
        title: "Re-engage 3 past clients",
        insight: "3 buyers closed 1+ year ago haven't heard from you in 60 days.",
        action: "Send a personalized check-in text to each.",
        actionUrl: "/dashboard/contacts?list=sphere",
        actionLabel: "Open sphere",
        context: ["Jane Ho", "Mike Chen", "Li Family"],
      },
      {
        id: "offer-stalled-main",
        priority: "medium",
        category: "stalled_offer",
        title: "Stalled offer on 500 Main St",
        insight: "No update in 9 days; listing agent hasn't responded.",
        action: "Call the listing agent.",
        actionUrl: "/dashboard/offers/abc-123",
        actionLabel: "Open offer",
        context: [],
      },
    ],
  });

  it("parses a clean JSON response", () => {
    const out = parseOpportunitiesResponse(sample);
    expect(out).toHaveLength(2);
    expect(out[0].title).toBe("Re-engage 3 past clients");
    expect(out[0].context).toEqual(["Jane Ho", "Mike Chen", "Li Family"]);
    expect(out[1].actionUrl).toBe("/dashboard/offers/abc-123");
  });

  it("strips markdown code fences", () => {
    const out = parseOpportunitiesResponse("```json\n" + sample + "\n```");
    expect(out).toHaveLength(2);
  });

  it("maps unknown categories to 'other' rather than dropping the card", () => {
    const out = parseOpportunitiesResponse(
      JSON.stringify({
        opportunities: [
          {
            id: "x",
            priority: "high",
            category: "made_up_category",
            title: "Title",
            insight: "Insight.",
            action: "Do it.",
            actionUrl: null,
            actionLabel: null,
            context: [],
          },
        ],
      }),
    );
    expect(out).toHaveLength(1);
    expect(out[0].category).toBe("other");
  });

  it("defaults bad priority to 'medium'", () => {
    const out = parseOpportunitiesResponse(
      JSON.stringify({
        opportunities: [
          {
            id: "x",
            priority: "urgent",
            category: "stalled_offer",
            title: "Title",
            insight: "Insight.",
            action: "Do it.",
            actionUrl: null,
            actionLabel: null,
            context: [],
          },
        ],
      }),
    );
    expect(out[0].priority).toBe("medium");
  });

  it("drops opportunities missing required text fields", () => {
    const out = parseOpportunitiesResponse(
      JSON.stringify({
        opportunities: [
          { id: "ok", priority: "high", category: "pipeline_gap", title: "Keeps momentum", insight: "Things look good.", action: "Keep it up.", actionUrl: null, actionLabel: null, context: [] },
          { id: "bad", priority: "high", category: "pipeline_gap", title: "", insight: "", action: "", actionUrl: null, actionLabel: null, context: [] },
        ],
      }),
    );
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("ok");
  });

  it("caps output at 5 opportunities even if the model returns more", () => {
    const items = Array.from({ length: 10 }, (_, i) => ({
      id: `opp-${i}`,
      priority: "medium",
      category: "other",
      title: `Title ${i}`,
      insight: "Insight.",
      action: "Do it.",
      actionUrl: null,
      actionLabel: null,
      context: [],
    }));
    const out = parseOpportunitiesResponse(JSON.stringify({ opportunities: items }));
    expect(out).toHaveLength(5);
  });

  it("caps context array at 3 items (UI design constraint)", () => {
    const out = parseOpportunitiesResponse(
      JSON.stringify({
        opportunities: [
          {
            id: "x",
            priority: "high",
            category: "stale_sphere",
            title: "t",
            insight: "i",
            action: "a",
            actionUrl: null,
            actionLabel: null,
            context: ["a", "b", "c", "d", "e"],
          },
        ],
      }),
    );
    expect(out[0].context).toEqual(["a", "b", "c"]);
  });

  it("returns empty array when opportunities is missing or not an array", () => {
    expect(parseOpportunitiesResponse(JSON.stringify({}))).toEqual([]);
    expect(parseOpportunitiesResponse(JSON.stringify({ opportunities: "not an array" }))).toEqual([]);
  });

  it("throws on invalid JSON", () => {
    expect(() => parseOpportunitiesResponse("not json")).toThrowError(/valid JSON/i);
  });

  it("truncates overly long titles / insights / actions", () => {
    const longTitle = "x".repeat(200);
    const out = parseOpportunitiesResponse(
      JSON.stringify({
        opportunities: [
          {
            id: "x",
            priority: "high",
            category: "stale_sphere",
            title: longTitle,
            insight: "i",
            action: "a",
            actionUrl: null,
            actionLabel: null,
            context: [],
          },
        ],
      }),
    );
    expect(out[0].title.length).toBeLessThanOrEqual(100);
    expect(out[0].title.endsWith("…")).toBe(true);
  });
});
