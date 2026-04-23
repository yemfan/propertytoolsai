import { describe, expect, it } from "vitest";
import {
  renderFeedbackRequestEmail,
  type FeedbackRequestInput,
} from "../renderRequestEmail";

function input(overrides: Partial<FeedbackRequestInput> = {}): FeedbackRequestInput {
  return {
    buyerAgentName: "Pat Buyer-Rep",
    propertyAddress: "500 Sutter St",
    city: "San Francisco",
    state: "CA",
    showingDate: "2026-05-15",
    formUrl: "https://app.test/feedback/abc123DEF456",
    listingAgentName: "Chris Listing",
    brokerage: "Great Brokerage",
    ...overrides,
  };
}

describe("renderFeedbackRequestEmail", () => {
  it("subject mentions the property address", () => {
    const out = renderFeedbackRequestEmail(input());
    expect(out.subject).toContain("500 Sutter St");
    expect(out.subject).toMatch(/feedback/i);
  });

  it("greets buyer-agent by first name when provided", () => {
    const out = renderFeedbackRequestEmail(input());
    expect(out.text).toMatch(/Hi Pat Buyer-Rep,/);
  });

  it("falls back to plain greeting when buyer-agent name missing", () => {
    const out = renderFeedbackRequestEmail(input({ buyerAgentName: null }));
    expect(out.text.split("\n")[0]).toBe("Hi,");
  });

  it("includes the showing date when set", () => {
    const out = renderFeedbackRequestEmail(input({ showingDate: "2026-05-15" }));
    expect(out.html).toContain("May 15, 2026");
  });

  it("softens wording when showing date is absent", () => {
    const out = renderFeedbackRequestEmail(input({ showingDate: null }));
    expect(out.html).toMatch(/recently viewed/);
    expect(out.html).not.toMatch(/viewed.*on May/i);
  });

  it("embeds the form URL in the CTA", () => {
    const out = renderFeedbackRequestEmail(input());
    expect(out.html).toContain("https://app.test/feedback/abc123DEF456");
  });

  it("escapes HTML in property address + buyer-agent name", () => {
    const out = renderFeedbackRequestEmail(
      input({
        propertyAddress: "<b>500</b> Sutter St",
        buyerAgentName: "Pat & Co",
      }),
    );
    expect(out.html).not.toContain("<b>500</b>");
    expect(out.html).toContain("&lt;b&gt;");
    expect(out.html).toContain("Pat &amp; Co");
  });

  it("uses plain signoff when listing agent name missing", () => {
    const out = renderFeedbackRequestEmail(input({ listingAgentName: null }));
    expect(out.text).toMatch(/— Listing agent/);
  });

  it("includes brokerage in the signoff when provided", () => {
    const out = renderFeedbackRequestEmail(input());
    expect(out.html).toContain("Chris Listing, Great Brokerage");
  });

  it("omits city/state when both are null", () => {
    const out = renderFeedbackRequestEmail(
      input({ city: null, state: null }),
    );
    expect(out.html).not.toMatch(/\(San Francisco, CA\)/);
  });
});
