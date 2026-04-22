/**
 * Pure net-to-seller math. Unit-tested without mocks.
 *
 * Formula:
 *
 *   price                    = offer_price (or current_price after counters)
 *   commission               = price × commission_pct / 100
 *   title_escrow             = price × title_escrow_pct / 100
 *   transfer_tax             = price × transfer_tax_pct / 100
 *   seller_concessions       = flat dollar amount requested in the offer
 *   other_costs              = flat dollar amount for things like HOA
 *                              transfer, home warranty, etc.
 *
 *   net                      = price - commission - title_escrow
 *                            - transfer_tax - seller_concessions
 *                            - other_costs
 *
 * Why this lives in its own module:
 *   * The compare view needs to compute net for N offers without
 *     calling the server; the pure function is the simplest
 *     mechanism.
 *   * Tax / title percentages vary by CA county; callers pass them
 *     in rather than hardcoding. Agent edits defaults once in the UI.
 *
 * Defaults are California-flavored but conservative. Transfer tax
 * varies by county (LA = 0.11%, SF = 0.5% city + 0.11% county).
 * We default to 0.11% (baseline + most counties); agent overrides
 * per-listing if higher.
 */

export type NetToSellerInputs = {
  price: number;
  /** Total commission pct the seller pays (both sides). e.g. 5 for 5%. */
  commissionPct: number;
  /** Title + escrow fees as pct of price. Typical CA: 1.0. */
  titleEscrowPct: number;
  /** Documentary transfer tax pct. Typical CA baseline: 0.11. */
  transferTaxPct: number;
  /** Flat dollar concessions to buyer (closing-cost credit, etc.). */
  sellerConcessions: number;
  /** Any other flat deductions — home warranty, HOA transfer, final water bill. */
  otherCostsFlat: number;
};

export type NetToSellerBreakdown = {
  price: number;
  commission: number;
  titleEscrow: number;
  transferTax: number;
  sellerConcessions: number;
  otherCostsFlat: number;
  net: number;
};

export const DEFAULT_NET_TO_SELLER_ASSUMPTIONS = {
  commissionPct: 5.0,
  titleEscrowPct: 1.0,
  transferTaxPct: 0.11,
  sellerConcessions: 0,
  otherCostsFlat: 0,
} as const;

export function computeNetToSeller(input: NetToSellerInputs): NetToSellerBreakdown {
  const price = clampNonNegative(input.price);
  const commission = round2(price * (input.commissionPct / 100));
  const titleEscrow = round2(price * (input.titleEscrowPct / 100));
  const transferTax = round2(price * (input.transferTaxPct / 100));
  const sellerConcessions = clampNonNegative(input.sellerConcessions);
  const otherCostsFlat = clampNonNegative(input.otherCostsFlat);
  const net =
    price - commission - titleEscrow - transferTax - sellerConcessions - otherCostsFlat;
  return {
    price,
    commission,
    titleEscrow,
    transferTax,
    sellerConcessions,
    otherCostsFlat,
    net: round2(net),
  };
}

/**
 * Offer-strength scoring. Higher net is better. Strong offers often
 * beat higher-priced ones that ask for big concessions — this helper
 * exists so the compare view can flag "strongest net" distinct from
 * "highest sticker."
 *
 * Ties break on fewest contingencies (cleaner close), then cash vs
 * financed (cash is faster + no appraisal risk).
 */
export function rankOffers<
  T extends {
    net: number;
    contingencyCount: number;
    isCash: boolean;
  },
>(offers: T[]): T[] {
  return [...offers].sort((a, b) => {
    if (b.net !== a.net) return b.net - a.net;
    if (a.contingencyCount !== b.contingencyCount)
      return a.contingencyCount - b.contingencyCount;
    if (a.isCash !== b.isCash) return a.isCash ? -1 : 1;
    return 0;
  });
}

function clampNonNegative(n: number): number {
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
