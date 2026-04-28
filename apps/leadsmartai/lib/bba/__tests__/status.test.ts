import { describe, expect, it } from "vitest";
import {
  canShowProperty,
  daysUntilExpiry,
  renewalStatus,
  type BbaInput,
} from "../status";

const NOW = "2026-04-28T12:00:00.000Z";

function bba(overrides: Partial<BbaInput> = {}): BbaInput {
  return {
    status: "signed",
    signedAt: "2026-01-01T00:00:00.000Z",
    effectiveStartDate: "2026-01-01",
    effectiveEndDate: "2026-12-31",
    terminatedAt: null,
    ...overrides,
  };
}

describe("canShowProperty", () => {
  it("returns false when no BBA exists", () => {
    expect(canShowProperty(null, NOW)).toBe(false);
  });

  it("returns true for a signed, in-window, non-terminated BBA", () => {
    expect(canShowProperty(bba(), NOW)).toBe(true);
  });

  it("returns false when status is anything other than signed", () => {
    expect(canShowProperty(bba({ status: "draft" }), NOW)).toBe(false);
    expect(canShowProperty(bba({ status: "sent" }), NOW)).toBe(false);
    expect(canShowProperty(bba({ status: "expired" }), NOW)).toBe(false);
    expect(canShowProperty(bba({ status: "terminated" }), NOW)).toBe(false);
    expect(canShowProperty(bba({ status: "declined" }), NOW)).toBe(false);
  });

  it("returns false when terminatedAt is set even if status hasn't been flipped", () => {
    expect(
      canShowProperty(
        bba({ status: "signed", terminatedAt: "2026-04-01T00:00:00Z" }),
        NOW,
      ),
    ).toBe(false);
  });

  it("returns false when effective_end_date is in the past", () => {
    expect(
      canShowProperty(bba({ effectiveEndDate: "2026-03-01" }), NOW),
    ).toBe(false);
  });

  it("treats end_date as end-of-day (BBA usable through the entire end_date)", () => {
    // NOW is mid-day on 2026-04-28; end_date=2026-04-28 should still be usable.
    expect(
      canShowProperty(bba({ effectiveEndDate: "2026-04-28" }), NOW),
    ).toBe(true);
  });

  it("treats null end_date as open-ended (always in window)", () => {
    expect(
      canShowProperty(bba({ effectiveEndDate: null }), NOW),
    ).toBe(true);
  });
});

describe("daysUntilExpiry", () => {
  it("returns null when end_date is missing", () => {
    expect(daysUntilExpiry(bba({ effectiveEndDate: null }), NOW)).toBeNull();
  });

  it("returns null when already expired", () => {
    expect(
      daysUntilExpiry(bba({ effectiveEndDate: "2026-01-01" }), NOW),
    ).toBeNull();
  });

  it("returns floor of remaining days", () => {
    // NOW: 2026-04-28T12:00:00Z; end: 2026-05-01T23:59:59Z → ~3.5 days remaining → floor 3
    const out = daysUntilExpiry(bba({ effectiveEndDate: "2026-05-01" }), NOW);
    expect(out).toBe(3);
  });
});

describe("renewalStatus", () => {
  it("returns 'missing' when no BBA exists", () => {
    expect(renewalStatus(null, NOW)).toBe("missing");
  });

  it("returns 'draft' for unsent drafts", () => {
    expect(renewalStatus(bba({ status: "draft" }), NOW)).toBe("draft");
  });

  it("returns 'sent_awaiting_signature' for sent-but-not-signed", () => {
    expect(renewalStatus(bba({ status: "sent" }), NOW)).toBe(
      "sent_awaiting_signature",
    );
  });

  it("collapses 'declined' to 'missing' (no agreement on file)", () => {
    expect(renewalStatus(bba({ status: "declined" }), NOW)).toBe("missing");
  });

  it("returns 'terminated' for explicitly terminated BBAs", () => {
    expect(renewalStatus(bba({ status: "terminated" }), NOW)).toBe("terminated");
  });

  it("returns 'expired' when persisted status is expired", () => {
    expect(renewalStatus(bba({ status: "expired" }), NOW)).toBe("expired");
  });

  it("returns 'active' for a signed BBA well within window", () => {
    expect(renewalStatus(bba(), NOW)).toBe("active");
  });

  it("returns 'expiring_soon' when within the threshold (default 30 days)", () => {
    // 20 days out
    const out = renewalStatus(
      bba({ effectiveEndDate: "2026-05-18" }),
      NOW,
    );
    expect(out).toBe("expiring_soon");
  });

  it("respects a custom expiringSoonDays window", () => {
    // 60 days out — outside default 30, inside 90
    const date60 = "2026-06-27";
    expect(renewalStatus(bba({ effectiveEndDate: date60 }), NOW)).toBe("active");
    expect(
      renewalStatus(bba({ effectiveEndDate: date60 }), NOW, {
        expiringSoonDays: 90,
      }),
    ).toBe("expiring_soon");
  });

  it("returns 'expired' when signed but past end_date", () => {
    expect(
      renewalStatus(bba({ effectiveEndDate: "2026-01-01" }), NOW),
    ).toBe("expired");
  });

  it("returns 'active' for signed open-ended BBAs (no end_date)", () => {
    expect(renewalStatus(bba({ effectiveEndDate: null }), NOW)).toBe("active");
  });

  it("returns 'terminated' when terminatedAt is set, regardless of signed status", () => {
    expect(
      renewalStatus(
        bba({ status: "signed", terminatedAt: "2026-04-01T00:00:00Z" }),
        NOW,
      ),
    ).toBe("terminated");
  });
});
