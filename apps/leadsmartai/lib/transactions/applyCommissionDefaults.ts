import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { computeCommission, defaultCommissionPctForType } from "@/lib/performance/commissionMath";
import type { TransactionRow } from "./types";

/**
 * Fills in commission fields from the agent's defaults when a
 * transaction is created or closes — but only if the agent hasn't
 * already set them on this deal.
 *
 * Agents frequently have unusual splits for individual deals
 * (referrals, team bonuses, flat-fee arrangements), so we NEVER
 * overwrite non-null commission fields. This function only fills in
 * what's missing.
 *
 * Re-computes `gross_commission` + `agent_net_commission` on every
 * update — those are derived from price + pct + referral + split,
 * so staleness is worse than re-write. Stored (not derived) because
 * historical dashboards shouldn't shift when the agent edits their
 * default prefs later.
 *
 * Swallows errors + logs loudly. A commission-math failure must never
 * block the primary DB write.
 */
export async function applyCommissionDefaults(tx: TransactionRow): Promise<{
  commission_pct: number | null;
  gross_commission: number | null;
  agent_net_commission: number | null;
  brokerage_split_pct: number | null;
  referral_fee_pct: number | null;
} | null> {
  if (!tx.purchase_price) return null;

  try {
    const { data: prefsData } = await supabaseAdmin
      .from("agent_commission_prefs")
      .select(
        "default_commission_pct_buyer, default_commission_pct_listing, default_brokerage_split_pct, default_referral_fee_pct",
      )
      .eq("agent_id", tx.agent_id)
      .maybeSingle();

    const prefs = (prefsData ?? {
      default_commission_pct_buyer: 2.5,
      default_commission_pct_listing: 3.0,
      default_brokerage_split_pct: 70.0,
      default_referral_fee_pct: 0.0,
    }) as {
      default_commission_pct_buyer: number;
      default_commission_pct_listing: number;
      default_brokerage_split_pct: number;
      default_referral_fee_pct: number;
    };

    // Fill in missing fields only — never overwrite the agent's overrides.
    const commissionPct =
      (tx as { commission_pct: number | null }).commission_pct ??
      defaultCommissionPctForType(tx.transaction_type, prefs);
    const splitPct =
      (tx as { brokerage_split_pct: number | null }).brokerage_split_pct ??
      prefs.default_brokerage_split_pct;
    const referralPct =
      (tx as { referral_fee_pct: number | null }).referral_fee_pct ??
      prefs.default_referral_fee_pct;

    const amounts = computeCommission({
      purchasePrice: tx.purchase_price,
      commissionPct,
      referralFeePct: referralPct,
      brokerageSplitPct: splitPct,
    });

    return {
      commission_pct: commissionPct,
      gross_commission: amounts.grossCommission,
      agent_net_commission: amounts.agentNetCommission,
      brokerage_split_pct: splitPct,
      referral_fee_pct: referralPct,
    };
  } catch (err) {
    console.error(
      `[transactions.applyCommissionDefaults] tx=${tx.id}:`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * Persist the computed commission patch back to the transaction. Split
 * from the compute function so the compute step is unit-testable
 * without supabase.
 */
export async function persistCommissionDefaults(
  tx: TransactionRow,
): Promise<void> {
  const patch = await applyCommissionDefaults(tx);
  if (!patch) return;
  try {
    await supabaseAdmin
      .from("transactions")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", tx.id);
  } catch (err) {
    console.error(
      `[transactions.persistCommissionDefaults] tx=${tx.id}:`,
      err instanceof Error ? err.message : err,
    );
  }
}
