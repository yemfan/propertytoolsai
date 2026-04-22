/**
 * Pure commission math helpers. Zero DB, zero side effects — unit-tested
 * without mocks. Used by both the transaction auto-close hook and the
 * performance analytics service so the definition of "net" stays in
 * one place.
 *
 * Formula (standard industry practice):
 *
 *   gross      = purchase_price * commission_pct / 100
 *   referral   = gross * referral_fee_pct / 100
 *   after_ref  = gross - referral
 *   net        = after_ref * brokerage_split_pct / 100
 *
 * Referral fees come off the TOP (before the agent/brokerage split) —
 * that's how the referring agent's contract works: "25% of the gross
 * commission to me, you split the rest with your brokerage."
 */

export type CommissionInputs = {
  purchasePrice: number | null;
  commissionPct: number | null;
  referralFeePct: number | null;
  brokerageSplitPct: number | null;
};

export type CommissionAmounts = {
  grossCommission: number | null;
  referralFee: number | null;
  agentNetCommission: number | null;
};

export function computeCommission(input: CommissionInputs): CommissionAmounts {
  if (
    input.purchasePrice == null ||
    input.commissionPct == null ||
    input.purchasePrice <= 0 ||
    input.commissionPct < 0
  ) {
    return { grossCommission: null, referralFee: null, agentNetCommission: null };
  }

  const gross = input.purchasePrice * (input.commissionPct / 100);
  const referralPct = input.referralFeePct ?? 0;
  const splitPct = input.brokerageSplitPct ?? 100;
  const referralFee = gross * (referralPct / 100);
  const afterReferral = gross - referralFee;
  const net = afterReferral * (splitPct / 100);

  return {
    grossCommission: round2(gross),
    referralFee: round2(referralFee),
    agentNetCommission: round2(net),
  };
}

/**
 * Defaults pulled from agent_commission_prefs — consumed by the
 * transaction-close hook. Returns a percentage based on transaction
 * type (buyer_rep vs listing_rep vs dual — dual uses buyer-rep pct
 * by default; agent can override per-deal).
 */
export function defaultCommissionPctForType(
  type: "buyer_rep" | "listing_rep" | "dual",
  prefs: { default_commission_pct_buyer: number; default_commission_pct_listing: number },
): number {
  if (type === "listing_rep") return prefs.default_commission_pct_listing;
  return prefs.default_commission_pct_buyer;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
