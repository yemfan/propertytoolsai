import { describe, expect, it } from "vitest";

import {
  formatInstantReplySms,
  isEligibleForInstantReply,
} from "@/lib/open-houses/instantReply";

describe("formatInstantReplySms — greeting", () => {
  it("uses the visitor's first name when present", () => {
    const out = formatInstantReplySms({
      visitorName: "Alex Chen",
      propertyAddress: "10 Elm St",
      agentFirstName: "Sam",
    });
    expect(out.startsWith("Hi Alex!")).toBe(true);
  });

  it("falls back to a neutral greeting when name is null", () => {
    const out = formatInstantReplySms({
      visitorName: null,
      propertyAddress: "10 Elm St",
      agentFirstName: "Sam",
    });
    expect(out.startsWith("Hi!")).toBe(true);
  });

  it("falls back to a neutral greeting when name is whitespace", () => {
    const out = formatInstantReplySms({
      visitorName: "   ",
      propertyAddress: "10 Elm St",
      agentFirstName: "Sam",
    });
    expect(out.startsWith("Hi!")).toBe(true);
  });

  it("uses only the first token of multi-word names", () => {
    const out = formatInstantReplySms({
      visitorName: "Mary Sue Johnson",
      propertyAddress: "10 Elm St",
      agentFirstName: "Sam",
    });
    expect(out.startsWith("Hi Mary!")).toBe(true);
  });
});

describe("formatInstantReplySms — agent identity", () => {
  it("names the agent in the body", () => {
    const out = formatInstantReplySms({
      visitorName: "Alex",
      propertyAddress: "10 Elm St",
      agentFirstName: "Sam",
    });
    expect(out).toContain("This is Sam.");
  });

  it("falls back gracefully when agent first name is missing", () => {
    const out = formatInstantReplySms({
      visitorName: "Alex",
      propertyAddress: "10 Elm St",
      agentFirstName: null,
    });
    expect(out).toContain("This is your agent.");
  });
});

describe("formatInstantReplySms — address shortening", () => {
  it("keeps short addresses as-is", () => {
    const out = formatInstantReplySms({
      visitorName: "A",
      propertyAddress: "123 Main St",
      agentFirstName: "Sam",
    });
    expect(out).toContain("123 Main St");
  });

  it("trims state + zip from full addresses", () => {
    const out = formatInstantReplySms({
      visitorName: "A",
      propertyAddress: "123 Main St, Austin, TX 78701",
      agentFirstName: "Sam",
    });
    expect(out).toContain("123 Main St, Austin");
    expect(out).not.toContain("78701");
    expect(out).not.toContain("TX");
  });

  it("keeps street + city for 4-part addresses", () => {
    const out = formatInstantReplySms({
      visitorName: "A",
      propertyAddress: "1 Long Way, Apt 5, Austin, TX 78701",
      agentFirstName: "Sam",
    });
    expect(out).toContain("1 Long Way, Apt 5");
  });
});

describe("formatInstantReplySms — segment budget", () => {
  it("keeps short cases inside one SMS segment (160 chars)", () => {
    const out = formatInstantReplySms({
      visitorName: "Alex",
      propertyAddress: "10 Elm St, Austin",
      agentFirstName: "Sam",
    });
    expect(out.length).toBeLessThanOrEqual(160);
  });

  it("drops the closing signature when the v1 form would exceed 160 chars", () => {
    const out = formatInstantReplySms({
      visitorName: "Alexandria",
      propertyAddress: "1234 Very Long Boulevard Name Avenue, Round Rock",
      agentFirstName: "Samuel",
    });
    expect(out.length).toBeLessThanOrEqual(160);
    // The closing dash-signature should drop in this case
    expect(out.endsWith("— Samuel")).toBe(false);
  });

  it("falls back to 'the open house' when the address itself overflows", () => {
    const out = formatInstantReplySms({
      visitorName: "Alexandria-Reynolds",
      propertyAddress:
        "12345 The Most Ridiculously Long Street Name In The Entire State Of Texas",
      agentFirstName: "Samuel",
    });
    expect(out.length).toBeLessThanOrEqual(160);
    expect(out).toContain("the open house");
  });
});

describe("formatInstantReplySms — content invariants", () => {
  it("always invites a reply (opens a thread)", () => {
    const cases = [
      { visitorName: "A", propertyAddress: "10 Elm St", agentFirstName: "S" },
      { visitorName: null, propertyAddress: "10 Elm St", agentFirstName: null },
      {
        visitorName: "Alexandria",
        propertyAddress: "1234 Very Long Street Name, City, State 99999",
        agentFirstName: "Samuel",
      },
    ];
    for (const c of cases) {
      const out = formatInstantReplySms(c);
      expect(out.toLowerCase()).toContain("reply");
    }
  });

  it("never includes opt-out boilerplate (visitor already consented in-form)", () => {
    const out = formatInstantReplySms({
      visitorName: "A",
      propertyAddress: "10 Elm St",
      agentFirstName: "Sam",
    });
    // SMS opt-out keywords are conventionally UPPERCASE ("Reply STOP to unsubscribe").
    // Don't lowercase — "stopping by" would false-positive.
    expect(out).not.toMatch(/\bSTOP\b/);
    expect(out.toLowerCase()).not.toContain("unsubscribe");
  });
});

describe("isEligibleForInstantReply", () => {
  const base = { phone: "+15125551234", marketingConsent: true, isBuyerAgented: false };

  it("true when phone + consent + not agented", () => {
    expect(isEligibleForInstantReply(base)).toBe(true);
  });

  it("false when phone is missing", () => {
    expect(isEligibleForInstantReply({ ...base, phone: null })).toBe(false);
  });

  it("false when marketing consent is missing", () => {
    expect(isEligibleForInstantReply({ ...base, marketingConsent: false })).toBe(false);
  });

  it("false when visitor is buyer-agented (ethics)", () => {
    expect(isEligibleForInstantReply({ ...base, isBuyerAgented: true })).toBe(false);
  });
});
