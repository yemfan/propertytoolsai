import { describe, expect, it } from "vitest";
import { isEligibleForReviewRequest } from "../eligibility";

const NOW = "2026-04-28T00:00:00.000Z";

function tx(overrides: Partial<{ id: string; status: string; closingDateActual: string | null }> = {}) {
  return {
    id: "tx-1",
    status: "closed",
    closingDateActual: "2026-04-15T00:00:00.000Z", // 13 days before NOW
    ...overrides,
  };
}

describe("isEligibleForReviewRequest", () => {
  it("accepts a closed transaction past cooldown, within lookback, not yet requested", () => {
    const out = isEligibleForReviewRequest({
      transaction: tx(),
      alreadyRequested: false,
      nowIso: NOW,
    });
    expect(out).toEqual({ eligible: true });
  });

  it("rejects when status isn't 'closed'", () => {
    const out = isEligibleForReviewRequest({
      transaction: tx({ status: "active" }),
      alreadyRequested: false,
      nowIso: NOW,
    });
    expect(out).toEqual({ eligible: false, reason: "not_closed" });
  });

  it("rejects when closing_date_actual is missing", () => {
    const out = isEligibleForReviewRequest({
      transaction: tx({ closingDateActual: null }),
      alreadyRequested: false,
      nowIso: NOW,
    });
    expect(out).toEqual({ eligible: false, reason: "missing_close_date" });
  });

  it("rejects when within cooldown (closed yesterday)", () => {
    const out = isEligibleForReviewRequest({
      transaction: tx({ closingDateActual: "2026-04-27T00:00:00.000Z" }),
      alreadyRequested: false,
      nowIso: NOW,
    });
    expect(out).toEqual({ eligible: false, reason: "too_recent" });
  });

  it("rejects when older than lookback (closed 6 months ago)", () => {
    const out = isEligibleForReviewRequest({
      transaction: tx({ closingDateActual: "2025-10-28T00:00:00.000Z" }),
      alreadyRequested: false,
      nowIso: NOW,
    });
    expect(out).toEqual({ eligible: false, reason: "too_old" });
  });

  it("rejects when a request has already been sent", () => {
    const out = isEligibleForReviewRequest({
      transaction: tx(),
      alreadyRequested: true,
      nowIso: NOW,
    });
    expect(out).toEqual({ eligible: false, reason: "already_requested" });
  });

  it("respects custom cooldown / lookback overrides", () => {
    // 13 days after close — would be eligible with default cooldown=7,
    // but if the agent sets cooldown=30, this falls back into 'too_recent'.
    const out = isEligibleForReviewRequest({
      transaction: tx(),
      alreadyRequested: false,
      nowIso: NOW,
      cooldownDays: 30,
    });
    expect(out).toEqual({ eligible: false, reason: "too_recent" });
  });

  it("rejects malformed closing dates", () => {
    const out = isEligibleForReviewRequest({
      transaction: tx({ closingDateActual: "not-a-date" }),
      alreadyRequested: false,
      nowIso: NOW,
    });
    expect(out).toEqual({ eligible: false, reason: "missing_close_date" });
  });
});
