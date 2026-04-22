import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/google-calendar/sync", () => ({
  upsertGoogleEvent: vi.fn(),
  deleteGoogleEvent: vi.fn(),
}));

// eslint-disable-next-line import/first
import {
  buildEventDescription,
  buildEventLocation,
  buildEventTitle,
  computeEndIso,
  needsResync,
} from "../googleSync";
import type { ShowingRow } from "../types";

function baseShowing(overrides: Partial<ShowingRow> = {}): ShowingRow {
  return {
    id: "s-1",
    agent_id: "agent-1",
    contact_id: "c-1",
    property_address: "123 Main St",
    city: "San Francisco",
    state: "CA",
    zip: "94110",
    mls_number: null,
    mls_url: null,
    scheduled_at: "2026-05-01T21:00:00.000Z",
    duration_minutes: 45,
    access_notes: "Lockbox 1234",
    listing_agent_name: "Pat Seller-Agent",
    listing_agent_email: "pat@brokerage.com",
    listing_agent_phone: "415-555-1212",
    status: "scheduled",
    cancellation_reason: null,
    notes: null,
    google_event_id: null,
    created_at: "2026-05-01T00:00:00.000Z",
    updated_at: "2026-05-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("computeEndIso", () => {
  it("adds the given duration to the start ISO", () => {
    expect(computeEndIso("2026-05-01T21:00:00.000Z", 30)).toBe("2026-05-01T21:30:00.000Z");
  });

  it("defaults to 30 minutes if duration is null", () => {
    expect(computeEndIso("2026-05-01T21:00:00.000Z", null)).toBe(
      "2026-05-01T21:30:00.000Z",
    );
  });

  it("defaults to 30 minutes if duration is zero or negative (bad data guard)", () => {
    expect(computeEndIso("2026-05-01T21:00:00.000Z", 0)).toBe("2026-05-01T21:30:00.000Z");
    expect(computeEndIso("2026-05-01T21:00:00.000Z", -15)).toBe("2026-05-01T21:30:00.000Z");
  });

  it("crosses UTC midnight correctly", () => {
    expect(computeEndIso("2026-05-01T23:30:00.000Z", 60)).toBe(
      "2026-05-02T00:30:00.000Z",
    );
  });
});

describe("buildEventTitle", () => {
  it("includes contact name when present", () => {
    expect(buildEventTitle("123 Main St", "Jane Buyer")).toBe(
      "Showing: 123 Main St (with Jane Buyer)",
    );
  });

  it("omits the parenthetical when contact name is null", () => {
    expect(buildEventTitle("123 Main St", null)).toBe("Showing: 123 Main St");
  });
});

describe("buildEventLocation", () => {
  it("assembles a full address with city + state + zip", () => {
    expect(
      buildEventLocation({
        property_address: "123 Main St",
        city: "San Francisco",
        state: "CA",
        zip: "94110",
      }),
    ).toBe("123 Main St San Francisco, CA 94110");
  });

  it("handles missing city + state gracefully", () => {
    expect(
      buildEventLocation({
        property_address: "123 Main St",
        city: null,
        state: null,
        zip: "94110",
      }),
    ).toBe("123 Main St 94110");
  });
});

describe("buildEventDescription", () => {
  it("includes buyer, listing agent, access, and MLS URL", () => {
    const out = buildEventDescription(baseShowing(), "Jane Buyer");
    expect(out).toContain("Buyer: Jane Buyer");
    expect(out).toContain("Pat Seller-Agent");
    expect(out).toContain("pat@brokerage.com");
    expect(out).toContain("415-555-1212");
    expect(out).toContain("Access: Lockbox 1234");
  });

  it("skips the listing-agent line when all three fields are null", () => {
    const out = buildEventDescription(
      baseShowing({
        listing_agent_name: null,
        listing_agent_email: null,
        listing_agent_phone: null,
      }),
      "Jane",
    );
    expect(out).not.toContain("Listing agent:");
  });

  it("puts the notes block at the end separated by a blank line", () => {
    const out = buildEventDescription(
      baseShowing({ notes: "Buyer wants to check water pressure" }),
      "Jane",
    );
    expect(out).toMatch(/\n\nBuyer wants to check water pressure$/);
  });
});

describe("needsResync", () => {
  it("returns true when scheduled_at changes", () => {
    const before = baseShowing();
    expect(needsResync(before, { scheduled_at: "2026-05-02T21:00:00.000Z" })).toBe(true);
  });

  it("returns true when duration or address changes", () => {
    const before = baseShowing();
    expect(needsResync(before, { duration_minutes: 60 })).toBe(true);
    expect(needsResync(before, { property_address: "456 Oak St" })).toBe(true);
    expect(needsResync(before, { city: "Oakland" })).toBe(true);
  });

  it("returns false for non-sync fields (notes, status, etc.)", () => {
    const before = baseShowing();
    expect(needsResync(before, { notes: "new notes" })).toBe(false);
    expect(needsResync(before, { status: "attended" })).toBe(false);
    expect(needsResync(before, { listing_agent_name: "New LA" })).toBe(false);
  });

  it("returns false when patch doesn't include a field (undefined)", () => {
    const before = baseShowing();
    expect(needsResync(before, {})).toBe(false);
  });
});
