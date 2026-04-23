import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import type {
  TransactionCounterpartyRow,
  TransactionRow,
  TransactionTaskRow,
} from "@/lib/transactions/types";
import type { DealReviewSnapshot } from "./types";

/**
 * Builds a DealReviewSnapshot from a closed transaction. Pure data
 * gathering — no AI calls. All math is deterministic so the agent can
 * sanity-check the prompt inputs via the UI / DB.
 *
 * "Days from anchor" values:
 *   - Buyer-rep deals anchor on mutual_acceptance_date.
 *   - Listing-rep deals anchor on listing_start_date (falls back to
 *     mutual_acceptance_date if listing_start is missing — which it
 *     shouldn't be for a well-tracked listing, but we don't crash).
 */
export async function gatherDealReviewSnapshot(
  transaction: TransactionRow,
): Promise<DealReviewSnapshot> {
  const tx = transaction;

  const anchor =
    tx.transaction_type === "listing_rep" || tx.transaction_type === "dual"
      ? tx.listing_start_date ?? tx.mutual_acceptance_date
      : tx.mutual_acceptance_date;

  const daysFrom = (iso: string | null): number | null => {
    if (!anchor || !iso) return null;
    return daysBetweenIso(anchor, iso.slice(0, 10));
  };

  const daysOnMarket =
    tx.transaction_type === "listing_rep" || tx.transaction_type === "dual"
      ? (() => {
          const startIso = tx.listing_start_date;
          const endIso = tx.closing_date_actual ?? tx.closing_date;
          if (!startIso || !endIso) return null;
          return daysBetweenIso(startIso, endIso.slice(0, 10));
        })()
      : null;

  const daysMutualToClose = (() => {
    const startIso = tx.mutual_acceptance_date;
    const endIso = tx.closing_date_actual;
    if (!startIso || !endIso) return null;
    return daysBetweenIso(startIso, endIso.slice(0, 10));
  })();

  // ── Tasks ─────────────────────────────────────────────────────────
  const { data: taskRows } = await supabaseAdmin
    .from("transaction_tasks")
    .select("title, due_date, completed_at")
    .eq("transaction_id", tx.id)
    .limit(500);
  const tasks = (taskRows ?? []) as Pick<
    TransactionTaskRow,
    "title" | "due_date" | "completed_at"
  >[];
  const taskTotal = tasks.length;
  let taskCompleted = 0;
  let taskOverdueAtClose = 0;
  let taskLateCount = 0;
  type Slip = { title: string; slipDays: number };
  const slips: Slip[] = [];

  for (const t of tasks) {
    if (t.completed_at) {
      taskCompleted += 1;
      if (t.due_date) {
        const slip = daysBetweenIso(t.due_date, t.completed_at.slice(0, 10));
        if (slip > 0) {
          taskLateCount += 1;
          slips.push({ title: t.title, slipDays: slip });
        }
      }
    } else if (
      t.due_date &&
      tx.closing_date_actual &&
      t.due_date < tx.closing_date_actual.slice(0, 10)
    ) {
      taskOverdueAtClose += 1;
    }
  }
  slips.sort((a, b) => b.slipDays - a.slipDays);

  // ── Counterparties ────────────────────────────────────────────────
  const { data: cpRows } = await supabaseAdmin
    .from("transaction_counterparties")
    .select("role")
    .eq("transaction_id", tx.id);
  const counterpartyRoles = [
    ...new Set(
      ((cpRows ?? []) as Pick<TransactionCounterpartyRow, "role">[]).map((r) => r.role),
    ),
  ];

  // ── Listing-side: offer data ──────────────────────────────────────
  let offerReceivedCount: number | null = null;
  let offerAcceptedCount: number | null = null;
  let offerAcceptedToListRatio: number | null = null;
  if (tx.transaction_type === "listing_rep" || tx.transaction_type === "dual") {
    const { data: offerRows } = await supabaseAdmin
      .from("listing_offers")
      .select("status, current_price, offer_price")
      .eq("transaction_id", tx.id);
    const offers = (offerRows ?? []) as Array<{
      status: string;
      current_price: number | null;
      offer_price: number;
    }>;
    offerReceivedCount = offers.length;
    const accepted = offers.filter((o) => o.status === "accepted");
    offerAcceptedCount = accepted.length;
    if (accepted.length === 1 && tx.purchase_price && tx.purchase_price > 0) {
      const acceptedPrice = accepted[0].current_price ?? accepted[0].offer_price;
      offerAcceptedToListRatio = acceptedPrice / tx.purchase_price;
    }
  }

  // ── Agent baseline for pattern commentary ─────────────────────────
  const { data: peerRows } = await supabaseAdmin
    .from("transactions")
    .select("mutual_acceptance_date, closing_date_actual")
    .eq("agent_id", tx.agent_id)
    .eq("status", "closed")
    .neq("id", tx.id)
    .not("closing_date_actual", "is", null)
    .not("mutual_acceptance_date", "is", null);
  const peers = (peerRows ?? []) as Array<{
    mutual_acceptance_date: string;
    closing_date_actual: string;
  }>;
  const peerDurations = peers
    .map((p) =>
      daysBetweenIso(p.mutual_acceptance_date, p.closing_date_actual.slice(0, 10)),
    )
    .filter((d) => d != null && d > 0);
  const agentAvgDaysMutualToClose =
    peerDurations.length > 0
      ? Math.round(peerDurations.reduce((a, b) => a + b, 0) / peerDurations.length)
      : null;

  return {
    transactionId: tx.id,
    transactionType: tx.transaction_type,
    propertyAddress: tx.property_address,
    purchasePrice: tx.purchase_price,
    mutualAcceptanceDate: tx.mutual_acceptance_date,
    listingStartDate: tx.listing_start_date,
    closingDate: tx.closing_date,
    closingDateActual: tx.closing_date_actual,
    daysOnMarket,
    daysMutualToClose,
    inspectionDeadlineDay: daysFrom(tx.inspection_deadline),
    inspectionCompletedDay: daysFrom(tx.inspection_completed_at),
    appraisalDeadlineDay: daysFrom(tx.appraisal_deadline),
    appraisalCompletedDay: daysFrom(tx.appraisal_completed_at),
    loanContingencyDeadlineDay: daysFrom(tx.loan_contingency_deadline),
    loanContingencyRemovedDay: daysFrom(tx.loan_contingency_removed_at),
    taskTotal,
    taskCompleted,
    taskOverdueAtClose,
    taskLateCount,
    taskSlipSamples: slips.slice(0, 5),
    counterpartyRoles,
    offerReceivedCount,
    offerAcceptedCount,
    offerAcceptedToListRatio,
    agentAvgDaysMutualToClose,
    agentClosedCount: peers.length,
    grossCommission: tx.gross_commission,
    agentNetCommission: tx.agent_net_commission,
  };
}

function daysBetweenIso(fromIso: string, toIso: string): number {
  const [fy, fm, fd] = fromIso.slice(0, 10).split("-").map(Number);
  const [ty, tm, td] = toIso.slice(0, 10).split("-").map(Number);
  const from = Date.UTC(fy, (fm ?? 1) - 1, fd ?? 1);
  const to = Date.UTC(ty, (tm ?? 1) - 1, td ?? 1);
  return Math.round((to - from) / 86_400_000);
}
