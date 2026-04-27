import type { BuyerPredictionLabel } from "@/lib/buyerPrediction/types";
import type { LifecycleStage } from "@/lib/contacts/types";
import type { SphereSellerLabel } from "@/lib/spherePrediction/types";

/**
 * Pure merger for the combined sphere-monetization view.
 *
 * Takes the two ranked lists from the seller-prediction and buyer-
 * prediction services (which scored the same cohort with different
 * weights) and joins them by contactId. The result is one row per
 * contact with BOTH scores side-by-side — the surface that answers
 * "which contacts are the biggest opportunity overall, in either
 * direction?"
 *
 * The natural follow-up the strategic gap analysis flagged: most past
 * clients eventually appear on both lists (sell-then-buy concurrent
 * move). The combined view surfaces the contacts where the agent's
 * leverage is HIGHEST — high score on either or both sides.
 */

/**
 * Slim shapes — the merger doesn't depend on the full row types from each
 * service so it stays insulated from downstream changes (e.g. if the
 * services add a `factors[]` array with breaking shape changes).
 */
export type SellerInputRow = {
  contactId: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  lifecycleStage: LifecycleStage;
  closingAddress: string | null;
  closingDate: string | null;
  score: number;
  label: SphereSellerLabel;
  topReason: string;
};

export type BuyerInputRow = {
  contactId: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  lifecycleStage: LifecycleStage;
  closingAddress: string | null;
  closingDate: string | null;
  score: number;
  label: BuyerPredictionLabel;
  topReason: string;
};

export type MonetizationSide = {
  score: number;
  label: SphereSellerLabel | BuyerPredictionLabel;
  topReason: string;
};

export type MonetizationRow = {
  contactId: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  lifecycleStage: LifecycleStage;
  closingAddress: string | null;
  closingDate: string | null;
  /** Seller-side prediction. Null when this contact didn't appear in the seller-ranked list. */
  seller: MonetizationSide | null;
  /** Buyer-side prediction. Null when this contact didn't appear in the buyer-ranked list. */
  buyer: MonetizationSide | null;
  /** Sum of the two scores (treats null as 0). Used as the default sort key. */
  combinedScore: number;
  /** True when both sides have a label of `medium` or `high`. UI uses this for the "both" filter. */
  bothMediumOrHigh: boolean;
};

function maxScore(side: MonetizationSide | null): number {
  return side ? side.score : 0;
}

function isMediumOrHigh(label: string): boolean {
  return label === "medium" || label === "high";
}

/**
 * Merge two ranked lists into per-contact monetization rows.
 *
 * Identity is taken from whichever side has the contact (seller takes
 * precedence when both have it — the underlying data is the same contact
 * row, but if for some reason the names diverge we prefer the seller-list
 * version for stability). Sorted by `combinedScore` desc with a stable
 * tie-break by seller score → buyer score → name.
 */
export function mergeMonetizationRows(
  sellerRows: ReadonlyArray<SellerInputRow>,
  buyerRows: ReadonlyArray<BuyerInputRow>,
): MonetizationRow[] {
  const byId = new Map<string, MonetizationRow>();

  for (const r of sellerRows) {
    byId.set(r.contactId, {
      contactId: r.contactId,
      fullName: r.fullName,
      email: r.email,
      phone: r.phone,
      lifecycleStage: r.lifecycleStage,
      closingAddress: r.closingAddress,
      closingDate: r.closingDate,
      seller: { score: r.score, label: r.label, topReason: r.topReason },
      buyer: null,
      combinedScore: 0,
      bothMediumOrHigh: false,
    });
  }

  for (const r of buyerRows) {
    const existing = byId.get(r.contactId);
    if (existing) {
      existing.buyer = { score: r.score, label: r.label, topReason: r.topReason };
    } else {
      byId.set(r.contactId, {
        contactId: r.contactId,
        fullName: r.fullName,
        email: r.email,
        phone: r.phone,
        lifecycleStage: r.lifecycleStage,
        closingAddress: r.closingAddress,
        closingDate: r.closingDate,
        seller: null,
        buyer: { score: r.score, label: r.label, topReason: r.topReason },
        combinedScore: 0,
        bothMediumOrHigh: false,
      });
    }
  }

  // Compute derived fields once now that both sides are populated.
  const rows = Array.from(byId.values()).map((row) => {
    const combinedScore = maxScore(row.seller) + maxScore(row.buyer);
    const bothMediumOrHigh = Boolean(
      row.seller &&
        row.buyer &&
        isMediumOrHigh(row.seller.label) &&
        isMediumOrHigh(row.buyer.label),
    );
    return { ...row, combinedScore, bothMediumOrHigh };
  });

  // Sort: combinedScore desc, then seller-score desc, then buyer-score desc, then name asc.
  rows.sort((a, b) => {
    if (b.combinedScore !== a.combinedScore) return b.combinedScore - a.combinedScore;
    const aSeller = maxScore(a.seller);
    const bSeller = maxScore(b.seller);
    if (bSeller !== aSeller) return bSeller - aSeller;
    const aBuyer = maxScore(a.buyer);
    const bBuyer = maxScore(b.buyer);
    if (bBuyer !== aBuyer) return bBuyer - aBuyer;
    return a.fullName.localeCompare(b.fullName);
  });

  return rows;
}

/**
 * Filter mode for the combined panel. Pure — the panel translates the chip
 * selection into one of these and we apply it here so the row count + the
 * filter logic stay aligned without bouncing through state.
 */
export type MonetizationFilter = "all" | "seller_leaning" | "buyer_leaning" | "both_high";

/**
 * Apply a filter to the merged rows. Pure.
 *
 *   all              → no filter
 *   seller_leaning   → seller present AND seller.score > buyer.score (or buyer absent)
 *   buyer_leaning    → buyer present AND buyer.score > seller.score (or seller absent)
 *   both_high        → both sides have label='high'
 */
export function filterMonetizationRows(
  rows: ReadonlyArray<MonetizationRow>,
  filter: MonetizationFilter,
): MonetizationRow[] {
  switch (filter) {
    case "all":
      return [...rows];
    case "seller_leaning":
      return rows.filter((r) => r.seller && (!r.buyer || r.seller.score > r.buyer.score));
    case "buyer_leaning":
      return rows.filter((r) => r.buyer && (!r.seller || r.buyer.score > r.seller.score));
    case "both_high":
      return rows.filter(
        (r) => r.seller?.label === "high" && r.buyer?.label === "high",
      );
  }
}
