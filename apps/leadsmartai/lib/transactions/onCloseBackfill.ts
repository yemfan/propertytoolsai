import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import type { TransactionRow } from "./types";

/**
 * When a transaction's status transitions to `closed`, mirror key closing
 * facts onto the associated `contacts` row. This is what keeps anniversary
 * campaigns + equity-milestone templates working a year or two later —
 * those workflows read `contacts.closing_date` + `closing_price` directly,
 * never joining through the transaction tables (by design — see the
 * comment in 20260485000000_transaction_coordinator.sql).
 *
 * Semantics:
 *   * Fires only on the active → closed transition; no-op for re-updates
 *     of an already-closed deal. That keeps accidental writes off the
 *     contact.
 *   * Overwrites prior values. If the contact bought another home in the
 *     past, the MOST RECENT close is what anniversary messaging should
 *     use. Historical sales live in the transaction rows.
 *   * `closing_price` falls back to `purchase_price` if `closing_date_actual`
 *     is set but a final settlement figure isn't separately tracked.
 *   * `closing_address` is populated from the transaction's property
 *     address — it's the home they actually closed on, which may differ
 *     from `address` (current residence) for a move-up buyer.
 *
 * Swallows errors and logs loudly — a failed backfill should never block
 * a successful status update.
 */
export async function applyOnCloseBackfill(
  before: Pick<TransactionRow, "status">,
  after: TransactionRow,
): Promise<void> {
  if (before.status === "closed") return;
  if (after.status !== "closed") return;
  if (!after.contact_id) return;

  const closingDate =
    after.closing_date_actual ?? after.closing_date ?? new Date().toISOString().slice(0, 10);
  const closingPrice = after.purchase_price ?? null;

  try {
    await supabaseAdmin
      .from("contacts")
      .update({
        closing_date: closingDate,
        closing_price: closingPrice,
        closing_address: after.property_address,
      })
      .eq("id", after.contact_id);
  } catch (err) {
    console.error(
      `[transactions.onCloseBackfill] contact=${after.contact_id} tx=${after.id}:`,
      err instanceof Error ? err.message : err,
    );
  }
}
