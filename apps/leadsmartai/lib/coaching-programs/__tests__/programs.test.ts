import { describe, expect, it } from "vitest";
import {
  agentPlanFromStoredPlan,
  canPlanAccessProgram,
  COACHING_PROGRAMS,
  planAutoEnrollsProgram,
  PROGRAM_ORDER,
  programsForPlan,
  getProgram,
} from "../programs";

describe("coaching-programs / registry", () => {
  it("has both Producer Track and Top Producer Track", () => {
    expect(getProgram("producer_track").name).toBe("Producer Track");
    expect(getProgram("top_producer_track").name).toBe("Top Producer Track");
  });

  it("PROGRAM_ORDER lists Producer Track before Top Producer Track", () => {
    expect(PROGRAM_ORDER).toEqual(["producer_track", "top_producer_track"]);
  });

  it("encodes the agreed targets (3% / 10 vs 5% / 15)", () => {
    expect(COACHING_PROGRAMS.producer_track.conversionRateTargetPct).toBe(3);
    expect(COACHING_PROGRAMS.producer_track.annualTransactionTarget).toBe(10);
    expect(COACHING_PROGRAMS.top_producer_track.conversionRateTargetPct).toBe(5);
    expect(COACHING_PROGRAMS.top_producer_track.annualTransactionTarget).toBe(15);
  });
});

describe("canPlanAccessProgram", () => {
  it("Producer Track: starter excluded; growth + elite + team included", () => {
    expect(canPlanAccessProgram({ plan: "starter", program: "producer_track" })).toBe(false);
    expect(canPlanAccessProgram({ plan: "growth", program: "producer_track" })).toBe(true);
    expect(canPlanAccessProgram({ plan: "elite", program: "producer_track" })).toBe(true);
    expect(canPlanAccessProgram({ plan: "team", program: "producer_track" })).toBe(true);
  });

  it("Top Producer Track: Premium + Team eligible; Starter + Pro excluded", () => {
    expect(canPlanAccessProgram({ plan: "starter", program: "top_producer_track" })).toBe(false);
    expect(canPlanAccessProgram({ plan: "growth", program: "top_producer_track" })).toBe(false);
    expect(canPlanAccessProgram({ plan: "elite", program: "top_producer_track" })).toBe(true);
    expect(canPlanAccessProgram({ plan: "team", program: "top_producer_track" })).toBe(true);
  });

  it("returns false for null plan (no entitlement at all)", () => {
    expect(canPlanAccessProgram({ plan: null, program: "producer_track" })).toBe(false);
    expect(canPlanAccessProgram({ plan: null, program: "top_producer_track" })).toBe(false);
  });
});

describe("planAutoEnrollsProgram", () => {
  it("Producer Track auto-enrolls on Pro, Premium, and Team", () => {
    expect(planAutoEnrollsProgram({ plan: "growth", program: "producer_track" })).toBe(true);
    expect(planAutoEnrollsProgram({ plan: "elite", program: "producer_track" })).toBe(true);
    expect(planAutoEnrollsProgram({ plan: "team", program: "producer_track" })).toBe(true);
  });

  it("Producer Track does NOT auto-enroll on Starter", () => {
    expect(planAutoEnrollsProgram({ plan: "starter", program: "producer_track" })).toBe(false);
  });

  it("Top Producer Track auto-enrolls on Premium and Team only", () => {
    expect(planAutoEnrollsProgram({ plan: "growth", program: "top_producer_track" })).toBe(false);
    expect(planAutoEnrollsProgram({ plan: "elite", program: "top_producer_track" })).toBe(true);
    expect(planAutoEnrollsProgram({ plan: "team", program: "top_producer_track" })).toBe(true);
  });
});

describe("programsForPlan", () => {
  it("starter / null → empty", () => {
    expect(programsForPlan(null)).toEqual([]);
    expect(programsForPlan("starter")).toEqual([]);
  });

  it("growth (Pro) → Producer Track only", () => {
    const out = programsForPlan("growth").map((p) => p.slug);
    expect(out).toEqual(["producer_track"]);
  });

  it("elite (Premium) → both programs in display order", () => {
    const out = programsForPlan("elite").map((p) => p.slug);
    expect(out).toEqual(["producer_track", "top_producer_track"]);
  });

  it("team → both programs in display order", () => {
    const out = programsForPlan("team").map((p) => p.slug);
    expect(out).toEqual(["producer_track", "top_producer_track"]);
  });
});

describe("coaching-programs / agentPlanFromStoredPlan", () => {
  it("maps starter / free → starter", () => {
    expect(agentPlanFromStoredPlan("starter")).toBe("starter");
    expect(agentPlanFromStoredPlan("free")).toBe("starter");
  });
  it("maps pro / growth → growth", () => {
    expect(agentPlanFromStoredPlan("pro")).toBe("growth");
    expect(agentPlanFromStoredPlan("growth")).toBe("growth");
  });
  it("maps elite / premium → elite", () => {
    expect(agentPlanFromStoredPlan("elite")).toBe("elite");
    expect(agentPlanFromStoredPlan("premium")).toBe("elite");
  });
  it("maps team → team", () => {
    expect(agentPlanFromStoredPlan("team")).toBe("team");
  });
  it("normalizes case", () => {
    expect(agentPlanFromStoredPlan("PREMIUM")).toBe("elite");
    expect(agentPlanFromStoredPlan("Team")).toBe("team");
  });
  it("returns null for unknown / null / empty", () => {
    expect(agentPlanFromStoredPlan(null)).toBeNull();
    expect(agentPlanFromStoredPlan(undefined)).toBeNull();
    expect(agentPlanFromStoredPlan("")).toBeNull();
    expect(agentPlanFromStoredPlan("legacy_god_mode")).toBeNull();
  });
});
