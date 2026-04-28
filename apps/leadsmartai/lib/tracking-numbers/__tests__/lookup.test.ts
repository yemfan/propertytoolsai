import { describe, expect, it } from "vitest";
import {
  findTrackingNumber,
  normalizeE164,
  resolveForwardTarget,
  type TrackingNumberRow,
} from "../lookup";

function row(overrides: Partial<TrackingNumberRow> = {}): TrackingNumberRow {
  return {
    id: "tn-1",
    agentId: "agent-1",
    phoneE164: "+14155551111",
    sourceLabel: "Zillow Premier",
    forwardToPhone: null,
    isActive: true,
    ...overrides,
  };
}

describe("normalizeE164", () => {
  it("preserves a clean E.164 number", () => {
    expect(normalizeE164("+14155551111")).toBe("+14155551111");
  });

  it("trims whitespace", () => {
    expect(normalizeE164("  +14155551111  ")).toBe("+14155551111");
  });

  it("strips formatting characters from a + prefixed number", () => {
    expect(normalizeE164("+1 (415) 555-1111")).toBe("+14155551111");
  });

  it("adds + prefix when bare digits look E.164-sized", () => {
    expect(normalizeE164("14155551111")).toBe("+14155551111");
    expect(normalizeE164("442012345678")).toBe("+442012345678");
  });

  it("returns null on null/empty input", () => {
    expect(normalizeE164(null)).toBeNull();
    expect(normalizeE164(undefined)).toBeNull();
    expect(normalizeE164("")).toBeNull();
    expect(normalizeE164("   ")).toBeNull();
  });

  it("rejects numbers outside the 7–15 digit range", () => {
    expect(normalizeE164("+123456")).toBeNull();
    expect(normalizeE164("+1234567890123456")).toBeNull();
  });
});

describe("findTrackingNumber", () => {
  const candidates: TrackingNumberRow[] = [
    row({ id: "tn-zillow", phoneE164: "+14155551111", sourceLabel: "Zillow" }),
    row({ id: "tn-fb", phoneE164: "+14155552222", sourceLabel: "Facebook" }),
    row({ id: "tn-paused", phoneE164: "+14155553333", sourceLabel: "Old", isActive: false }),
  ];

  it("finds the matching row by E.164 phone", () => {
    const out = findTrackingNumber("+14155552222", candidates);
    expect(out?.id).toBe("tn-fb");
    expect(out?.sourceLabel).toBe("Facebook");
  });

  it("normalizes the input before comparing (Twilio sometimes drops + prefix)", () => {
    const out = findTrackingNumber("14155551111", candidates);
    expect(out?.id).toBe("tn-zillow");
  });

  it("returns null when no candidate matches", () => {
    expect(findTrackingNumber("+14155559999", candidates)).toBeNull();
  });

  it("returns null when the matching row is inactive (paused number stays unattributed)", () => {
    expect(findTrackingNumber("+14155553333", candidates)).toBeNull();
  });

  it("returns null on missing input", () => {
    expect(findTrackingNumber(null, candidates)).toBeNull();
    expect(findTrackingNumber("", candidates)).toBeNull();
  });

  it("returns null when the candidate set is empty", () => {
    expect(findTrackingNumber("+14155551111", [])).toBeNull();
  });
});

describe("resolveForwardTarget", () => {
  it("prefers the tracking number's forward_to_phone when set", () => {
    const out = resolveForwardTarget({
      trackingNumber: row({ forwardToPhone: "+14155557777" }),
      agentPrimaryPhone: "+14155558888",
    });
    expect(out).toBe("+14155557777");
  });

  it("falls back to the agent's primary phone when forward_to_phone is null", () => {
    const out = resolveForwardTarget({
      trackingNumber: row({ forwardToPhone: null }),
      agentPrimaryPhone: "+14155558888",
    });
    expect(out).toBe("+14155558888");
  });

  it("returns null when neither is set", () => {
    const out = resolveForwardTarget({
      trackingNumber: row({ forwardToPhone: null }),
      agentPrimaryPhone: null,
    });
    expect(out).toBeNull();
  });

  it("normalizes both candidates so a missing + prefix doesn't cause a false null", () => {
    const out = resolveForwardTarget({
      trackingNumber: row({ forwardToPhone: "14155557777" }),
      agentPrimaryPhone: null,
    });
    expect(out).toBe("+14155557777");
  });
});
