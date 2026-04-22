import { describe, expect, it } from "vitest";
import {
  DEFAULT_NET_TO_SELLER_ASSUMPTIONS,
  computeNetToSeller,
  rankOffers,
} from "../netToSeller";

describe("computeNetToSeller", () => {
  it("standard CA deal: $1M offer, 5% commission, 1% title/escrow, 0.11% transfer tax", () => {
    const out = computeNetToSeller({
      price: 1_000_000,
      commissionPct: 5,
      titleEscrowPct: 1,
      transferTaxPct: 0.11,
      sellerConcessions: 0,
      otherCostsFlat: 0,
    });
    expect(out.commission).toBe(50_000);
    expect(out.titleEscrow).toBe(10_000);
    expect(out.transferTax).toBe(1_100);
    expect(out.net).toBe(938_900);
  });

  it("seller concessions reduce net dollar-for-dollar", () => {
    const out = computeNetToSeller({
      price: 1_000_000,
      commissionPct: 5,
      titleEscrowPct: 1,
      transferTaxPct: 0.11,
      sellerConcessions: 10_000,
      otherCostsFlat: 0,
    });
    expect(out.net).toBe(928_900);
  });

  it("other flat costs (home warranty, HOA transfer) subtract cleanly", () => {
    const out = computeNetToSeller({
      price: 1_000_000,
      commissionPct: 5,
      titleEscrowPct: 1,
      transferTaxPct: 0.11,
      sellerConcessions: 0,
      otherCostsFlat: 2_500,
    });
    expect(out.net).toBe(936_400);
  });

  it("a lower-priced cleaner offer can NET more than a higher one with concessions", () => {
    const cleanOffer = computeNetToSeller({
      price: 990_000,
      commissionPct: 5,
      titleEscrowPct: 1,
      transferTaxPct: 0.11,
      sellerConcessions: 0,
      otherCostsFlat: 0,
    });
    const dirtyHigherOffer = computeNetToSeller({
      price: 1_000_000,
      commissionPct: 5,
      titleEscrowPct: 1,
      transferTaxPct: 0.11,
      sellerConcessions: 25_000, // buyer asks for $25k credit
      otherCostsFlat: 0,
    });
    // This is the core insight of net-to-seller: sticker price isn't
    // the right metric, net is.
    expect(cleanOffer.net).toBeGreaterThan(dirtyHigherOffer.net);
  });

  it("clamps negative inputs (bad data guard)", () => {
    const out = computeNetToSeller({
      price: -100,
      commissionPct: 5,
      titleEscrowPct: 1,
      transferTaxPct: 0.11,
      sellerConcessions: -50,
      otherCostsFlat: -25,
    });
    expect(out.price).toBe(0);
    expect(out.sellerConcessions).toBe(0);
    expect(out.otherCostsFlat).toBe(0);
    expect(out.net).toBe(0);
  });

  it("0% commission (FSBO-style flat-fee listing) removes that deduction", () => {
    const out = computeNetToSeller({
      price: 1_000_000,
      commissionPct: 0,
      titleEscrowPct: 1,
      transferTaxPct: 0.11,
      sellerConcessions: 0,
      otherCostsFlat: 0,
    });
    expect(out.commission).toBe(0);
    expect(out.net).toBe(988_900);
  });

  it("rounds to pennies — no floating-point ghost digits", () => {
    const out = computeNetToSeller({
      price: 1_333_333,
      commissionPct: 5.25,
      titleEscrowPct: 1,
      transferTaxPct: 0.11,
      sellerConcessions: 0,
      otherCostsFlat: 0,
    });
    expect(Number.isInteger(out.commission * 100)).toBe(true);
    expect(Number.isInteger(out.net * 100)).toBe(true);
  });

  it("defaults are sane for a 'just tell me the ballpark' use case", () => {
    const out = computeNetToSeller({
      price: 1_000_000,
      ...DEFAULT_NET_TO_SELLER_ASSUMPTIONS,
    });
    // 5% + 1% + 0.11% = 6.11% of $1M = $61,100. Net = $938,900.
    expect(out.net).toBe(938_900);
  });
});

describe("rankOffers", () => {
  it("sorts highest net first", () => {
    const out = rankOffers([
      { id: "a", net: 900_000, contingencyCount: 2, isCash: false },
      { id: "b", net: 950_000, contingencyCount: 3, isCash: false },
      { id: "c", net: 920_000, contingencyCount: 0, isCash: true },
    ]);
    expect(out.map((o) => o.id)).toEqual(["b", "c", "a"]);
  });

  it("ties on net break toward fewer contingencies", () => {
    const out = rankOffers([
      { id: "a", net: 900_000, contingencyCount: 3, isCash: false },
      { id: "b", net: 900_000, contingencyCount: 0, isCash: false },
      { id: "c", net: 900_000, contingencyCount: 2, isCash: false },
    ]);
    expect(out.map((o) => o.id)).toEqual(["b", "c", "a"]);
  });

  it("ties on net + contingencies break toward cash (no appraisal risk)", () => {
    const out = rankOffers([
      { id: "a", net: 900_000, contingencyCount: 0, isCash: false },
      { id: "b", net: 900_000, contingencyCount: 0, isCash: true },
    ]);
    expect(out.map((o) => o.id)).toEqual(["b", "a"]);
  });

  it("empty input returns empty", () => {
    expect(rankOffers([])).toEqual([]);
  });
});
