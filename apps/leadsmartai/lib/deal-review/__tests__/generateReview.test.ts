import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/anthropic", () => ({
  getAnthropicClient: () => {
    throw new Error("should not be called in pure-parser tests");
  },
}));

// eslint-disable-next-line import/first
import {
  buildFallbackReview,
  parseDealReviewResponse,
} from "../generateReview";
// eslint-disable-next-line import/first
import type { DealReviewSnapshot } from "../types";

function snapshot(overrides: Partial<DealReviewSnapshot> = {}): DealReviewSnapshot {
  return {
    transactionId: "tx-1",
    transactionType: "buyer_rep",
    propertyAddress: "500 Sutter St",
    purchasePrice: 1_200_000,
    mutualAcceptanceDate: "2026-04-01",
    listingStartDate: null,
    closingDate: "2026-05-01",
    closingDateActual: "2026-05-03",
    daysOnMarket: null,
    daysMutualToClose: 32,
    inspectionDeadlineDay: 17,
    inspectionCompletedDay: 15,
    appraisalDeadlineDay: 17,
    appraisalCompletedDay: 18,
    loanContingencyDeadlineDay: 21,
    loanContingencyRemovedDay: 21,
    taskTotal: 28,
    taskCompleted: 27,
    taskOverdueAtClose: 0,
    taskLateCount: 2,
    taskSlipSamples: [
      { title: "Review inspection reports with buyer", slipDays: 3 },
      { title: "Submit repair request", slipDays: 1 },
    ],
    counterpartyRoles: ["title", "lender", "inspector"],
    offerReceivedCount: null,
    offerAcceptedCount: null,
    offerAcceptedToListRatio: null,
    agentAvgDaysMutualToClose: 30,
    agentClosedCount: 5,
    grossCommission: 30_000,
    agentNetCommission: 21_000,
    ...overrides,
  };
}

describe("parseDealReviewResponse", () => {
  it("parses a clean JSON response with all sections", () => {
    const raw = JSON.stringify({
      headline: "Strong close on the Sutter deal",
      summary: "Two late tasks but overall clean execution.",
      whatWentWell: ["Inspection on schedule", "CTC landed on day 21"],
      whereItStalled: ["2 tasks slipped"],
      patternObservations: ["32 days is 2 days over your average"],
      doDifferentlyNextTime: ["Start inspection report review 48h before the due date"],
      executionScore: 0.85,
    });
    const out = parseDealReviewResponse(raw);
    expect(out.headline).toContain("Sutter");
    expect(out.whatWentWell).toHaveLength(2);
    expect(out.executionScore).toBe(0.85);
  });

  it("strips markdown code fences", () => {
    const raw = "```json\n" + JSON.stringify({
      headline: "x",
      summary: "",
      whatWentWell: [],
      whereItStalled: [],
      patternObservations: [],
      doDifferentlyNextTime: ["Keep it up."],
      executionScore: null,
    }) + "\n```";
    const out = parseDealReviewResponse(raw);
    expect(out.headline).toBe("x");
    expect(out.executionScore).toBeNull();
  });

  it("caps arrays at their documented max lengths", () => {
    const raw = JSON.stringify({
      headline: "x",
      summary: "y",
      whatWentWell: ["a", "b", "c", "d", "e"],
      whereItStalled: ["1", "2", "3", "4"],
      patternObservations: ["p1", "p2", "p3", "p4"],
      doDifferentlyNextTime: ["x", "y", "z", "w"],
      executionScore: 0.5,
    });
    const out = parseDealReviewResponse(raw);
    expect(out.whatWentWell).toHaveLength(3);
    expect(out.whereItStalled).toHaveLength(3);
    expect(out.patternObservations).toHaveLength(2);
    expect(out.doDifferentlyNextTime).toHaveLength(3);
  });

  it("clamps executionScore into 0..1 and maps bad values to null", () => {
    expect(
      parseDealReviewResponse(
        JSON.stringify({
          headline: "",
          summary: "",
          whatWentWell: [],
          whereItStalled: [],
          patternObservations: [],
          doDifferentlyNextTime: [],
          executionScore: 1.5,
        }),
      ).executionScore,
    ).toBe(1);
    expect(
      parseDealReviewResponse(
        JSON.stringify({
          headline: "",
          summary: "",
          whatWentWell: [],
          whereItStalled: [],
          patternObservations: [],
          doDifferentlyNextTime: [],
          executionScore: "not a number",
        }),
      ).executionScore,
    ).toBeNull();
  });

  it("falls back to sensible defaults on partial data (no throw)", () => {
    const out = parseDealReviewResponse("{}");
    expect(out.headline).toBeTruthy(); // defaults to "Deal closed."
    expect(out.whatWentWell).toEqual([]);
    expect(out.doDifferentlyNextTime).toEqual([]);
  });

  it("throws on invalid JSON", () => {
    expect(() => parseDealReviewResponse("not json")).toThrowError(/valid JSON/i);
  });
});

describe("buildFallbackReview", () => {
  it("surfaces a late-task slip when one exists", () => {
    const out = buildFallbackReview(snapshot());
    expect(out.whereItStalled.some((s) => /late/i.test(s) || /slip/i.test(s))).toBe(true);
  });

  it("flags the agent's slowest-to-close deal vs their average", () => {
    const out = buildFallbackReview(
      snapshot({ daysMutualToClose: 40, agentAvgDaysMutualToClose: 30 }),
    );
    expect(out.whereItStalled.some((s) => /slower/i.test(s))).toBe(true);
  });

  it("celebrates a faster-than-average close", () => {
    const out = buildFallbackReview(
      snapshot({
        daysMutualToClose: 24,
        agentAvgDaysMutualToClose: 30,
        taskLateCount: 0,
        taskSlipSamples: [],
      }),
    );
    expect(out.whatWentWell.some((s) => /faster/i.test(s))).toBe(true);
  });

  it("praises a full checklist when ≥90% completed", () => {
    const out = buildFallbackReview(
      snapshot({ taskTotal: 28, taskCompleted: 27, taskLateCount: 0, taskSlipSamples: [] }),
    );
    expect(out.whatWentWell.some((s) => /96%|checklist tasks/i.test(s))).toBe(true);
  });

  it("flags <95% listing accepted-to-list ratio", () => {
    const out = buildFallbackReview(
      snapshot({
        transactionType: "listing_rep",
        offerAcceptedToListRatio: 0.92,
      }),
    );
    expect(out.whereItStalled.some((s) => /92%|discount/i.test(s))).toBe(true);
  });

  it("celebrates at-or-above-list listing offer", () => {
    const out = buildFallbackReview(
      snapshot({
        transactionType: "listing_rep",
        offerAcceptedToListRatio: 1.02,
        taskLateCount: 0,
        taskSlipSamples: [],
      }),
    );
    expect(out.whatWentWell.some((s) => /102%|at or above/i.test(s))).toBe(true);
  });

  it("includes open-at-close tasks in doDifferentlyNextTime", () => {
    const out = buildFallbackReview(snapshot({ taskOverdueAtClose: 3 }));
    expect(
      out.doDifferentlyNextTime.some((s) => /still open|overdue|open at close/i.test(s)),
    ).toBe(true);
  });

  it("returns a 'keep doing what you're doing' default when nothing needs fixing", () => {
    const out = buildFallbackReview(
      snapshot({
        taskLateCount: 0,
        taskSlipSamples: [],
        taskOverdueAtClose: 0,
        daysMutualToClose: 30,
        agentAvgDaysMutualToClose: 30,
      }),
    );
    expect(out.doDifferentlyNextTime.length).toBeGreaterThan(0);
  });

  it("never returns an executionScore (AI-only field)", () => {
    expect(buildFallbackReview(snapshot()).executionScore).toBeNull();
  });
});
