import { describe, expect, it } from "vitest";
import { calculateLeadScore, getLeadTemperature } from "./rules";

describe("getLeadTemperature", () => {
  it("maps score bands", () => {
    expect(getLeadTemperature(100)).toBe("hot");
    expect(getLeadTemperature(80)).toBe("hot");
    expect(getLeadTemperature(79)).toBe("warm");
    expect(getLeadTemperature(50)).toBe("warm");
    expect(getLeadTemperature(49)).toBe("cold");
    expect(getLeadTemperature(0)).toBe("cold");
  });
});

describe("calculateLeadScore", () => {
  const recent = new Date(Date.now() - 30 * 60 * 1000).toISOString();

  it("caps at 100", () => {
    const score = calculateLeadScore(
      {
        source: "smart_property_match",
        intent: "tour_request",
        price: 900_000,
        last_activity_at: recent,
      },
      Array.from({ length: 20 }, () => ({ event_type: "email_open", created_at: recent })),
      5
    );
    expect(score).toBe(100);
  });

  it("weights listing_inquiry and applies recency", () => {
    const score = calculateLeadScore(
      {
        source: "listing_inquiry",
        intent: "listing_inquiry",
        price: null,
        last_activity_at: recent,
      },
      [],
      0
    );
    expect(score).toBe(35 + 20);
  });

  it("counts inbound messages and email opens", () => {
    const score = calculateLeadScore(
      {
        source: "unknown",
        intent: null,
        price: null,
        last_activity_at: recent,
      },
      [
        { event_type: "sms_reply", created_at: recent },
        { event_type: "email_open", created_at: recent },
        { event_type: "email_open", created_at: recent },
      ],
      1
    );
    expect(score).toBe(10 + 20 + 4 + 20);
  });

  it("maps affordability_lender_match like affordability_report", () => {
    const a = calculateLeadScore(
      { source: "affordability_report", intent: null, price: null, last_activity_at: recent },
      [],
      0
    );
    const b = calculateLeadScore(
      { source: "affordability_lender_match", intent: null, price: null, last_activity_at: recent },
      [],
      0
    );
    expect(a).toBe(b);
    expect(a).toBe(25 + 20);
  });
});
