import { describe, expect, it } from "vitest";

import {
  filterMonetizationRows,
  mergeMonetizationRows,
  type BuyerInputRow,
  type SellerInputRow,
} from "@/lib/sphereMonetization/mergeRows";

function seller(
  id: string,
  fullName: string,
  score: number,
  label: SellerInputRow["label"],
  topReason = `seller-reason-${id}`,
): SellerInputRow {
  return {
    contactId: id,
    fullName,
    email: null,
    phone: null,
    lifecycleStage: "past_client",
    closingAddress: null,
    closingDate: null,
    score,
    label,
    topReason,
  };
}

function buyer(
  id: string,
  fullName: string,
  score: number,
  label: BuyerInputRow["label"],
  topReason = `buyer-reason-${id}`,
): BuyerInputRow {
  return {
    contactId: id,
    fullName,
    email: null,
    phone: null,
    lifecycleStage: "past_client",
    closingAddress: null,
    closingDate: null,
    score,
    label,
    topReason,
  };
}

describe("mergeMonetizationRows — basic", () => {
  it("returns empty for empty inputs", () => {
    expect(mergeMonetizationRows([], [])).toEqual([]);
  });

  it("seller-only contacts get seller side populated, buyer null", () => {
    const out = mergeMonetizationRows([seller("a", "A", 80, "high")], []);
    expect(out).toHaveLength(1);
    expect(out[0].seller?.score).toBe(80);
    expect(out[0].buyer).toBeNull();
  });

  it("buyer-only contacts get buyer side populated, seller null", () => {
    const out = mergeMonetizationRows([], [buyer("a", "A", 75, "high")]);
    expect(out).toHaveLength(1);
    expect(out[0].buyer?.score).toBe(75);
    expect(out[0].seller).toBeNull();
  });

  it("a contact in BOTH lists merges into one row with both sides", () => {
    const out = mergeMonetizationRows(
      [seller("a", "A", 80, "high", "tenure peak")],
      [buyer("a", "A", 65, "medium", "job change")],
    );
    expect(out).toHaveLength(1);
    expect(out[0].seller?.score).toBe(80);
    expect(out[0].seller?.topReason).toBe("tenure peak");
    expect(out[0].buyer?.score).toBe(65);
    expect(out[0].buyer?.topReason).toBe("job change");
  });
});

describe("mergeMonetizationRows — combined score + sort", () => {
  it("combinedScore = seller + buyer (treats nulls as 0)", () => {
    const both = mergeMonetizationRows(
      [seller("a", "A", 80, "high")],
      [buyer("a", "A", 65, "medium")],
    );
    expect(both[0].combinedScore).toBe(145);

    const sellerOnly = mergeMonetizationRows([seller("b", "B", 80, "high")], []);
    expect(sellerOnly[0].combinedScore).toBe(80);

    const buyerOnly = mergeMonetizationRows([], [buyer("c", "C", 70, "high")]);
    expect(buyerOnly[0].combinedScore).toBe(70);
  });

  it("sorts by combinedScore desc — both-list contacts surface above single-list", () => {
    const out = mergeMonetizationRows(
      [seller("a", "A", 80, "high"), seller("b", "B", 90, "high")],
      [buyer("a", "A", 70, "high"), buyer("c", "C", 95, "high")],
    );
    // a: 80+70=150, b: 90+0=90, c: 0+95=95
    expect(out.map((r) => r.contactId)).toEqual(["a", "c", "b"]);
  });

  it("tie-breaks by seller score desc when combined ties", () => {
    const out = mergeMonetizationRows(
      [seller("a", "A", 70, "high"), seller("b", "B", 50, "medium")],
      [buyer("a", "A", 30, "low"), buyer("b", "B", 50, "medium")],
    );
    // both 100; a has higher seller score, so first
    expect(out.map((r) => r.contactId)).toEqual(["a", "b"]);
  });

  it("tie-breaks by buyer score when combined + seller tie", () => {
    const out = mergeMonetizationRows(
      [seller("a", "Alex", 50, "medium"), seller("b", "Bob", 50, "medium")],
      [buyer("a", "Alex", 60, "medium"), buyer("b", "Bob", 70, "medium")],
    );
    // both seller 50, but b has higher buyer
    expect(out.map((r) => r.contactId)).toEqual(["b", "a"]);
  });

  it("tie-breaks by name asc when combined + seller + buyer all tie", () => {
    const out = mergeMonetizationRows(
      [seller("z", "Zara", 50, "medium"), seller("a", "Alex", 50, "medium")],
      [buyer("z", "Zara", 50, "medium"), buyer("a", "Alex", 50, "medium")],
    );
    // identical scores — alphabetical wins
    expect(out.map((r) => r.contactId)).toEqual(["a", "z"]);
  });
});

describe("mergeMonetizationRows — bothMediumOrHigh flag", () => {
  it("true when both sides are medium-or-high", () => {
    const out = mergeMonetizationRows(
      [seller("a", "A", 50, "medium")],
      [buyer("a", "A", 70, "high")],
    );
    expect(out[0].bothMediumOrHigh).toBe(true);
  });

  it("false when one side is low", () => {
    const out = mergeMonetizationRows(
      [seller("a", "A", 50, "medium")],
      [buyer("a", "A", 25, "low")],
    );
    expect(out[0].bothMediumOrHigh).toBe(false);
  });

  it("false when one side is missing", () => {
    const out = mergeMonetizationRows([seller("a", "A", 80, "high")], []);
    expect(out[0].bothMediumOrHigh).toBe(false);
  });
});

describe("mergeMonetizationRows — identity", () => {
  it("uses the seller-list name when contact is in both (stability)", () => {
    const out = mergeMonetizationRows(
      [seller("a", "Alex Chen", 80, "high")],
      [buyer("a", "ALEX CHEN", 70, "high")],
    );
    expect(out[0].fullName).toBe("Alex Chen");
  });

  it("uses the buyer-list name when contact is buyer-only", () => {
    const out = mergeMonetizationRows([], [buyer("a", "Alex Chen", 75, "high")]);
    expect(out[0].fullName).toBe("Alex Chen");
  });
});

describe("filterMonetizationRows", () => {
  function rows() {
    return mergeMonetizationRows(
      [
        seller("seller_only", "Seller Only", 75, "high"),
        seller("both_balanced", "Both Balanced", 70, "high"),
        seller("seller_leaning", "Seller Leaning", 80, "high"),
        seller("both_high", "Both High", 75, "high"),
      ],
      [
        buyer("buyer_only", "Buyer Only", 80, "high"),
        buyer("both_balanced", "Both Balanced", 70, "high"),
        buyer("seller_leaning", "Seller Leaning", 50, "medium"),
        buyer("both_high", "Both High", 75, "high"),
      ],
    );
  }

  it("'all' returns every row", () => {
    expect(filterMonetizationRows(rows(), "all").length).toBe(5);
  });

  it("'seller_leaning' returns rows where seller present AND seller > buyer", () => {
    const ids = filterMonetizationRows(rows(), "seller_leaning")
      .map((r) => r.contactId)
      .sort();
    expect(ids).toEqual(["seller_leaning", "seller_only"]);
  });

  it("'buyer_leaning' returns rows where buyer present AND buyer > seller", () => {
    const ids = filterMonetizationRows(rows(), "buyer_leaning")
      .map((r) => r.contactId)
      .sort();
    expect(ids).toEqual(["buyer_only"]);
  });

  it("'both_high' returns rows where both labels are 'high' exactly", () => {
    const ids = filterMonetizationRows(rows(), "both_high")
      .map((r) => r.contactId)
      .sort();
    expect(ids).toEqual(["both_balanced", "both_high"]);
  });
});
