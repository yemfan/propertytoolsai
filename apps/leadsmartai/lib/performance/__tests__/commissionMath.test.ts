import { describe, expect, it } from "vitest";
import { computeCommission, defaultCommissionPctForType } from "../commissionMath";

describe("computeCommission", () => {
  it("applies standard 2.5% buyer-side commission with 70/30 split and no referral", () => {
    const out = computeCommission({
      purchasePrice: 1_200_000,
      commissionPct: 2.5,
      referralFeePct: 0,
      brokerageSplitPct: 70,
    });
    // Gross = 1.2M * 2.5% = 30,000
    // Referral = 0
    // Net = 30,000 * 70% = 21,000
    expect(out.grossCommission).toBe(30_000);
    expect(out.referralFee).toBe(0);
    expect(out.agentNetCommission).toBe(21_000);
  });

  it("deducts referral fee BEFORE brokerage split (industry standard)", () => {
    const out = computeCommission({
      purchasePrice: 1_000_000,
      commissionPct: 3.0,
      referralFeePct: 25, // 25% referral
      brokerageSplitPct: 80,
    });
    // Gross = 30,000
    // Referral = 30,000 * 25% = 7,500
    // After referral = 22,500
    // Net = 22,500 * 80% = 18,000
    expect(out.grossCommission).toBe(30_000);
    expect(out.referralFee).toBe(7_500);
    expect(out.agentNetCommission).toBe(18_000);
  });

  it("100/0 split (solo practitioner on their own BRE license) returns full after-referral", () => {
    const out = computeCommission({
      purchasePrice: 800_000,
      commissionPct: 2.5,
      referralFeePct: 0,
      brokerageSplitPct: 100,
    });
    expect(out.agentNetCommission).toBe(20_000);
  });

  it("defaults missing referral + split to the non-reducing values (0% referral, 100% split)", () => {
    const out = computeCommission({
      purchasePrice: 500_000,
      commissionPct: 3.0,
      referralFeePct: null,
      brokerageSplitPct: null,
    });
    // Gross = 15,000; no referral, no split deduction → net = gross
    expect(out.grossCommission).toBe(15_000);
    expect(out.agentNetCommission).toBe(15_000);
  });

  it("returns all nulls when price or pct is missing", () => {
    expect(
      computeCommission({
        purchasePrice: null,
        commissionPct: 2.5,
        referralFeePct: 0,
        brokerageSplitPct: 70,
      }),
    ).toEqual({
      grossCommission: null,
      referralFee: null,
      agentNetCommission: null,
    });

    expect(
      computeCommission({
        purchasePrice: 1_000_000,
        commissionPct: null,
        referralFeePct: 0,
        brokerageSplitPct: 70,
      }),
    ).toEqual({
      grossCommission: null,
      referralFee: null,
      agentNetCommission: null,
    });
  });

  it("returns all nulls for a $0 or negative price (bad data guard)", () => {
    expect(
      computeCommission({
        purchasePrice: 0,
        commissionPct: 2.5,
        referralFeePct: 0,
        brokerageSplitPct: 70,
      }).grossCommission,
    ).toBeNull();
    expect(
      computeCommission({
        purchasePrice: -100,
        commissionPct: 2.5,
        referralFeePct: 0,
        brokerageSplitPct: 70,
      }).grossCommission,
    ).toBeNull();
  });

  it("rounds to 2 decimals (pennies) — avoids .999999 display weirdness", () => {
    const out = computeCommission({
      purchasePrice: 1_333_333,
      commissionPct: 2.5,
      referralFeePct: 0,
      brokerageSplitPct: 70,
    });
    expect(out.grossCommission).toBe(33_333.33);
    expect(out.agentNetCommission).toBe(23_333.33);
  });
});

describe("defaultCommissionPctForType", () => {
  const prefs = {
    default_commission_pct_buyer: 2.5,
    default_commission_pct_listing: 3.0,
  };

  it("returns the buyer-side default for buyer_rep", () => {
    expect(defaultCommissionPctForType("buyer_rep", prefs)).toBe(2.5);
  });

  it("returns the listing-side default for listing_rep", () => {
    expect(defaultCommissionPctForType("listing_rep", prefs)).toBe(3.0);
  });

  it("treats dual agency as buyer-rep for default pct (agent overrides per deal)", () => {
    expect(defaultCommissionPctForType("dual", prefs)).toBe(2.5);
  });
});
