import { describe, expect, it } from "vitest";
import { normalizeHomeValueEstimateRequestBody } from "../normalizeEstimateRequestBody";

describe("normalizeHomeValueEstimateRequestBody", () => {
  it("maps nested V2 body to flat pipeline request", () => {
    const body = normalizeHomeValueEstimateRequestBody({
      address: {
        fullAddress: "123 Main St, Pasadena, CA 91101",
        city: "Pasadena",
        state: "CA",
        zip: "91101",
      },
      details: {
        beds: 3,
        baths: 2,
        sqft: 1650,
        yearBuilt: 1988,
        condition: "good",
        renovatedRecently: false,
      },
      context: { sessionId: "sess_123", source: "tool_page" },
    });
    expect(body.address).toContain("123 Main");
    expect(body.city).toBe("Pasadena");
    expect(body.beds).toBe(3);
    expect(body.session_id).toBe("sess_123");
    expect(body.condition).toBe("good");
    expect(body.renovation).toBe("none");
  });

  it("passes through flat request", () => {
    const flat = { address: "1 Oak", city: "Austin", state: "TX", beds: 2 };
    expect(normalizeHomeValueEstimateRequestBody(flat)).toEqual(flat);
  });
});
