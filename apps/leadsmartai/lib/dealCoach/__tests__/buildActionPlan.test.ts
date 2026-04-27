import { describe, expect, it } from "vitest";

import {
  buildDealCoachActionPlan,
  buildHeadline,
} from "@/lib/dealCoach/buildActionPlan";
import type {
  DealCoachActionInput,
  DealStage,
} from "@/lib/dealCoach/types";
import type { DealRiskAssessment } from "@/lib/risk";

function risk(
  overpay: "low" | "medium" | "high",
  appraisal: "low" | "medium" | "high",
  market: "low" | "medium" | "high",
): DealRiskAssessment {
  const score = { low: 20, medium: 50, high: 80 } as const;
  return {
    overpay: { level: overpay, score: score[overpay], notes: `overpay ${overpay}` },
    appraisal: { level: appraisal, score: score[appraisal], notes: `appraisal ${appraisal}` },
    market: { level: market, score: score[market], notes: `market ${market}` },
  };
}

function ids(plan: ReturnType<typeof buildDealCoachActionPlan>): string[] {
  return plan.actions.map((a) => a.id);
}

describe("buildDealCoachActionPlan — stage baselines", () => {
  it("drafting: validate price, draft cover letter, verify proof of funds", () => {
    const out = buildDealCoachActionPlan({ stage: "drafting" });
    expect(ids(out)).toEqual([
      "validate_price",
      "draft_cover_letter",
      "verify_proof_of_funds",
    ]);
  });

  it("sent: monitor only when no timing signals are present", () => {
    const out = buildDealCoachActionPlan({ stage: "sent" });
    expect(ids(out)).toEqual(["monitor_response"]);
  });

  it("countered: respond + review-changed-terms (both high priority)", () => {
    const out = buildDealCoachActionPlan({ stage: "countered" });
    expect(ids(out)).toEqual(["respond_to_counter", "review_terms_changed"]);
    expect(out.actions.every((a) => a.priority === "high")).toBe(true);
  });

  it("accepted: schedule inspection, lock financing, send to title", () => {
    const out = buildDealCoachActionPlan({ stage: "accepted" });
    expect(ids(out)).toEqual([
      "schedule_inspection",
      "lock_financing",
      "send_executed_to_title",
    ]);
  });

  it("rejected: capture reason + queue relisting alert", () => {
    const out = buildDealCoachActionPlan({ stage: "rejected" });
    expect(ids(out)).toEqual([
      "review_rejection_reason",
      "queue_relisting_alert",
    ]);
  });
});

describe("buildDealCoachActionPlan — risk triggers", () => {
  it("high overpay surfaces a high-priority reassessment action", () => {
    const out = buildDealCoachActionPlan({
      stage: "drafting",
      risks: risk("high", "low", "low"),
    });
    expect(ids(out)).toContain("reassess_overpay");
    const a = out.actions.find((x) => x.id === "reassess_overpay");
    expect(a?.priority).toBe("high");
  });

  it("medium overpay surfaces a softer pre-mortem action (not high priority)", () => {
    const out = buildDealCoachActionPlan({
      stage: "drafting",
      risks: risk("medium", "low", "low"),
    });
    expect(ids(out)).toContain("monitor_overpay");
    expect(ids(out)).not.toContain("reassess_overpay");
    const a = out.actions.find((x) => x.id === "monitor_overpay");
    expect(a?.priority).toBe("medium");
  });

  it("high appraisal risk inserts a contingency-plan action", () => {
    const out = buildDealCoachActionPlan({
      stage: "drafting",
      risks: risk("low", "high", "low"),
    });
    expect(ids(out)).toContain("appraisal_contingency_plan");
  });

  it("high market risk inserts a market-pressure-strategy action", () => {
    const out = buildDealCoachActionPlan({
      stage: "drafting",
      risks: risk("low", "low", "high"),
    });
    expect(ids(out)).toContain("market_pressure_strategy");
  });

  it("stacks risk actions — multi-axis high risk surfaces all three", () => {
    const out = buildDealCoachActionPlan({
      stage: "drafting",
      risks: risk("high", "high", "high"),
    });
    expect(ids(out)).toContain("reassess_overpay");
    expect(ids(out)).toContain("appraisal_contingency_plan");
    expect(ids(out)).toContain("market_pressure_strategy");
  });

  it("uses the risk pillar's notes string in the rationale when provided", () => {
    const r = risk("high", "low", "low");
    r.overpay.notes = "Offer is 6% above the median comp.";
    const out = buildDealCoachActionPlan({ stage: "drafting", risks: r });
    const a = out.actions.find((x) => x.id === "reassess_overpay");
    expect(a?.rationale).toContain("6% above");
  });
});

describe("buildDealCoachActionPlan — timing triggers", () => {
  it("sent + <48h elapsed: only baseline 'monitor' action", () => {
    const out = buildDealCoachActionPlan({
      stage: "sent",
      hoursSinceLastAgentAction: 24,
    });
    expect(ids(out)).toEqual(["monitor_response"]);
  });

  it("sent + 48h elapsed: emits polite-followup at medium priority", () => {
    const out = buildDealCoachActionPlan({
      stage: "sent",
      hoursSinceLastAgentAction: 48,
    });
    expect(ids(out)).toContain("polite_followup_sent");
    expect(ids(out)).not.toContain("strong_followup_sent");
  });

  it("sent + 72h+ elapsed: emits strong-followup at high priority", () => {
    const out = buildDealCoachActionPlan({
      stage: "sent",
      hoursSinceLastAgentAction: 96,
    });
    expect(ids(out)).toContain("strong_followup_sent");
    const a = out.actions.find((x) => x.id === "strong_followup_sent");
    expect(a?.priority).toBe("high");
  });

  it("countered + 12h+ elapsed: emits urgent-respond at high priority", () => {
    const out = buildDealCoachActionPlan({
      stage: "countered",
      hoursSinceLastAgentAction: 18,
    });
    expect(ids(out)).toContain("respond_counter_urgent");
  });

  it("countered + <12h elapsed: no urgent-respond yet (counter just arrived)", () => {
    const out = buildDealCoachActionPlan({
      stage: "countered",
      hoursSinceLastAgentAction: 4,
    });
    expect(ids(out)).not.toContain("respond_counter_urgent");
  });
});

describe("buildDealCoachActionPlan — competition / budget triggers", () => {
  it("multi-offer + drafting: differentiate-in-multioffer at high priority", () => {
    const out = buildDealCoachActionPlan({
      stage: "drafting",
      competingOfferCount: 3,
    });
    expect(ids(out)).toContain("differentiate_in_multioffer");
  });

  it("does NOT emit multi-offer action if offer is already sent", () => {
    const out = buildDealCoachActionPlan({
      stage: "sent",
      competingOfferCount: 3,
    });
    expect(ids(out)).not.toContain("differentiate_in_multioffer");
  });

  it("budgetTight: emits walk-away threshold action at medium priority", () => {
    const out = buildDealCoachActionPlan({
      stage: "drafting",
      budgetTight: true,
    });
    const a = out.actions.find((x) => x.id === "budget_walkaway_threshold");
    expect(a?.priority).toBe("medium");
  });
});

describe("buildDealCoachActionPlan — sort + stability", () => {
  it("sorts high before medium before low", () => {
    const out = buildDealCoachActionPlan({
      stage: "drafting",
      risks: risk("high", "low", "low"),
    });
    const priorities = out.actions.map((a) => a.priority);
    const highIdx = priorities.lastIndexOf("high");
    const mediumIdx = priorities.indexOf("medium");
    if (highIdx !== -1 && mediumIdx !== -1) {
      expect(highIdx).toBeLessThan(mediumIdx);
    }
  });

  it("preserves insertion order within the same priority (stable)", () => {
    // drafting + multi-offer + high overpay all emit a 'high' action.
    // Stage baseline 'validate_price' should come before risk
    // 'reassess_overpay' which should come before competition
    // 'differentiate_in_multioffer'.
    const out = buildDealCoachActionPlan({
      stage: "drafting",
      risks: risk("high", "low", "low"),
      competingOfferCount: 3,
    });
    const high = out.actions.filter((a) => a.priority === "high").map((a) => a.id);
    expect(high.indexOf("validate_price")).toBeLessThan(
      high.indexOf("reassess_overpay"),
    );
    expect(high.indexOf("reassess_overpay")).toBeLessThan(
      high.indexOf("differentiate_in_multioffer"),
    );
  });

  it("returns an empty plan for an unknown stage (defensive)", () => {
    const out = buildDealCoachActionPlan({
      stage: "unknown" as unknown as DealStage,
    });
    expect(out.actions).toEqual([]);
  });
});

describe("buildHeadline", () => {
  it("returns a stage-specific label when there are no high risks", () => {
    expect(buildHeadline({ stage: "drafting" })).toBe("Drafting the offer.");
    expect(buildHeadline({ stage: "sent" })).toBe(
      "Offer sent — waiting on the seller.",
    );
    expect(buildHeadline({ stage: "countered" })).toBe(
      "Seller countered — your move.",
    );
    expect(buildHeadline({ stage: "accepted" })).toBe("Under contract.");
    expect(buildHeadline({ stage: "rejected" })).toBe("Offer rejected.");
  });

  it("appends a 'High risk: ...' suffix when risk pillars are high", () => {
    const out = buildHeadline({
      stage: "drafting",
      risks: risk("high", "high", "low"),
    });
    expect(out).toContain("High risk:");
    expect(out).toContain("overpay");
    expect(out).toContain("appraisal");
    expect(out).not.toContain("market");
  });

  it("falls back to a generic stage label when stage is unknown", () => {
    const out = buildHeadline({ stage: "phantom" as unknown as DealStage });
    expect(out).toContain("Active deal");
  });

  it("input shape: only `stage` is required (rest are optional)", () => {
    // Compile-time check: this must accept a minimal input without TS yelling.
    const minimal: DealCoachActionInput = { stage: "drafting" };
    expect(buildHeadline(minimal)).toBeTruthy();
    expect(buildDealCoachActionPlan(minimal).actions.length).toBeGreaterThan(0);
  });
});
