import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import type {
  CounterDirection,
  FinancingType,
  ListingOfferCompareItem,
  ListingOfferCounterRow,
  ListingOfferRow,
  ListingOfferStatus,
} from "./types";

/**
 * Listing-side offer service. Scope:
 *   - Verify the parent transaction belongs to the agent AND is listing-side.
 *   - CRUD + counter-round recording + status transitions.
 *
 * `acceptOffer()` only flips one offer to `accepted`. It does NOT
 * auto-reject the others — the listing agent sometimes accepts one,
 * lets others linger as backups for a few days, then rejects them
 * after contingency removal. We leave that to manual workflow.
 */

// ── Ownership guard ───────────────────────────────────────────────────

async function assertListingTransactionOwned(
  agentId: string,
  transactionId: string,
): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from("transactions")
    .select("id, transaction_type")
    .eq("id", transactionId)
    .eq("agent_id", agentId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Transaction not found");
  const type = (data as { transaction_type: string }).transaction_type;
  if (type !== "listing_rep" && type !== "dual") {
    throw new Error("Listing offers can only be added to listing-side deals.");
  }
}

// ── CREATE ────────────────────────────────────────────────────────────

export type CreateListingOfferInput = {
  agentId: string;
  transactionId: string;
  offerPrice: number;
  buyerName?: string | null;
  buyerBrokerage?: string | null;
  buyerAgentName?: string | null;
  buyerAgentEmail?: string | null;
  buyerAgentPhone?: string | null;
  earnestMoney?: number | null;
  downPayment?: number | null;
  financingType?: FinancingType | null;
  closingDateProposed?: string | null;
  inspectionContingency?: boolean;
  appraisalContingency?: boolean;
  loanContingency?: boolean;
  saleOfHomeContingency?: boolean;
  contingencyNotes?: string | null;
  sellerConcessions?: number | null;
  offerExpiresAt?: string | null;
  notes?: string | null;
};

export async function createListingOffer(
  input: CreateListingOfferInput,
): Promise<ListingOfferRow> {
  await assertListingTransactionOwned(input.agentId, input.transactionId);

  const { data, error } = await supabaseAdmin
    .from("listing_offers")
    .insert({
      agent_id: input.agentId,
      transaction_id: input.transactionId,
      buyer_name: input.buyerName ?? null,
      buyer_brokerage: input.buyerBrokerage ?? null,
      buyer_agent_name: input.buyerAgentName ?? null,
      buyer_agent_email: input.buyerAgentEmail ?? null,
      buyer_agent_phone: input.buyerAgentPhone ?? null,
      offer_price: input.offerPrice,
      current_price: input.offerPrice,
      earnest_money: input.earnestMoney ?? null,
      down_payment: input.downPayment ?? null,
      financing_type: input.financingType ?? null,
      closing_date_proposed: input.closingDateProposed ?? null,
      inspection_contingency: input.inspectionContingency ?? true,
      appraisal_contingency: input.appraisalContingency ?? true,
      loan_contingency: input.loanContingency ?? true,
      sale_of_home_contingency: input.saleOfHomeContingency ?? false,
      contingency_notes: input.contingencyNotes ?? null,
      seller_concessions: input.sellerConcessions ?? null,
      offer_expires_at: input.offerExpiresAt ?? null,
      notes: input.notes ?? null,
      status: "submitted",
      submitted_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Failed to create listing offer");
  return data as ListingOfferRow;
}

// ── READ ──────────────────────────────────────────────────────────────

/**
 * Compare-view list: all offers on a single listing, oriented for the
 * side-by-side view. Enriches with counter counts + derived fields.
 */
export async function listOffersForTransaction(
  agentId: string,
  transactionId: string,
): Promise<ListingOfferCompareItem[]> {
  await assertListingTransactionOwned(agentId, transactionId);

  const { data, error } = await supabaseAdmin
    .from("listing_offers")
    .select("*")
    .eq("agent_id", agentId)
    .eq("transaction_id", transactionId)
    .order("current_price", { ascending: false, nullsFirst: false });
  if (error) throw new Error(error.message);
  const offers = (data ?? []) as ListingOfferRow[];
  if (!offers.length) return [];

  const offerIds = offers.map((o) => o.id);
  const { data: counterRows } = await supabaseAdmin
    .from("listing_offer_counters")
    .select("listing_offer_id")
    .in("listing_offer_id", offerIds);
  const counterCountByOffer = new Map<string, number>();
  for (const c of (counterRows ?? []) as Array<{ listing_offer_id: string }>) {
    counterCountByOffer.set(c.listing_offer_id, (counterCountByOffer.get(c.listing_offer_id) ?? 0) + 1);
  }

  return offers.map((o) => ({
    ...o,
    counter_count: counterCountByOffer.get(o.id) ?? 0,
    contingency_count:
      (o.inspection_contingency ? 1 : 0) +
      (o.appraisal_contingency ? 1 : 0) +
      (o.loan_contingency ? 1 : 0) +
      (o.sale_of_home_contingency ? 1 : 0),
    is_cash: o.financing_type === "cash",
  }));
}

export async function getListingOfferWithCounters(
  agentId: string,
  listingOfferId: string,
): Promise<{
  offer: ListingOfferRow;
  counters: ListingOfferCounterRow[];
} | null> {
  const { data: offerData, error } = await supabaseAdmin
    .from("listing_offers")
    .select("*")
    .eq("id", listingOfferId)
    .eq("agent_id", agentId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!offerData) return null;

  const { data: counters } = await supabaseAdmin
    .from("listing_offer_counters")
    .select("*")
    .eq("listing_offer_id", listingOfferId)
    .order("counter_number", { ascending: true });

  return {
    offer: offerData as ListingOfferRow,
    counters: (counters ?? []) as ListingOfferCounterRow[],
  };
}

// ── UPDATE ────────────────────────────────────────────────────────────

export type UpdateListingOfferInput = Partial<{
  buyer_name: string | null;
  buyer_brokerage: string | null;
  buyer_agent_name: string | null;
  buyer_agent_email: string | null;
  buyer_agent_phone: string | null;
  offer_price: number;
  current_price: number | null;
  earnest_money: number | null;
  down_payment: number | null;
  financing_type: FinancingType | null;
  closing_date_proposed: string | null;
  inspection_contingency: boolean;
  appraisal_contingency: boolean;
  loan_contingency: boolean;
  sale_of_home_contingency: boolean;
  contingency_notes: string | null;
  seller_concessions: number | null;
  status: ListingOfferStatus;
  offer_expires_at: string | null;
  notes: string | null;
}>;

export async function updateListingOffer(
  agentId: string,
  listingOfferId: string,
  input: UpdateListingOfferInput,
  opts?: { rejectSiblingsOnAccept?: boolean },
): Promise<{ offer: ListingOfferRow | null; siblingsRejected: number }> {
  const { data: before } = await supabaseAdmin
    .from("listing_offers")
    .select("status, transaction_id")
    .eq("id", listingOfferId)
    .eq("agent_id", agentId)
    .maybeSingle();
  if (!before) return { offer: null, siblingsRejected: 0 };
  const beforeRow = before as {
    status: ListingOfferStatus;
    transaction_id: string;
  };

  const patch: UpdateListingOfferInput & {
    updated_at: string;
    accepted_at?: string;
    closed_at?: string;
  } = { ...input, updated_at: new Date().toISOString() };

  const beforeStatus = beforeRow.status;
  const nowIso = new Date().toISOString();
  if (input.status && input.status !== beforeStatus) {
    if (input.status === "accepted") patch.accepted_at = nowIso;
    if (["rejected", "withdrawn", "expired"].includes(input.status)) patch.closed_at = nowIso;
  }

  const { data, error } = await supabaseAdmin
    .from("listing_offers")
    .update(patch)
    .eq("id", listingOfferId)
    .eq("agent_id", agentId)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  const offer = (data as ListingOfferRow | null) ?? null;

  // Optional sibling auto-reject: when the agent accepts THIS offer,
  // mark all other still-live offers on the same listing as rejected
  // so the compare view reflects the real state of the deal. Kept as
  // an opt-in flag (default off) — listing agents sometimes keep
  // sibling offers alive as backups until contingencies clear.
  let siblingsRejected = 0;
  if (
    opts?.rejectSiblingsOnAccept &&
    offer &&
    input.status === "accepted" &&
    beforeStatus !== "accepted"
  ) {
    const { data: updatedSiblings } = await supabaseAdmin
      .from("listing_offers")
      .update({ status: "rejected", closed_at: nowIso, updated_at: nowIso })
      .eq("transaction_id", beforeRow.transaction_id)
      .eq("agent_id", agentId)
      .neq("id", listingOfferId)
      .in("status", ["submitted", "countered"])
      .select("id");
    siblingsRejected = (updatedSiblings as Array<{ id: string }> | null)?.length ?? 0;
  }

  return { offer, siblingsRejected };
}

export async function deleteListingOffer(
  agentId: string,
  listingOfferId: string,
): Promise<boolean> {
  const { error, count } = await supabaseAdmin
    .from("listing_offers")
    .delete({ count: "exact" })
    .eq("id", listingOfferId)
    .eq("agent_id", agentId);
  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}

// ── Counters ──────────────────────────────────────────────────────────

export type AddCounterInput = {
  direction: CounterDirection;
  price?: number | null;
  changedFields?: Record<string, unknown> | null;
  notes?: string | null;
};

export async function addListingOfferCounter(
  agentId: string,
  listingOfferId: string,
  input: AddCounterInput,
): Promise<ListingOfferCounterRow> {
  const { data: offerRow } = await supabaseAdmin
    .from("listing_offers")
    .select("id")
    .eq("id", listingOfferId)
    .eq("agent_id", agentId)
    .maybeSingle();
  if (!offerRow) throw new Error("Listing offer not found");

  const { data: existingCounters } = await supabaseAdmin
    .from("listing_offer_counters")
    .select("counter_number")
    .eq("listing_offer_id", listingOfferId)
    .order("counter_number", { ascending: false })
    .limit(1);
  const nextNumber =
    (((existingCounters ?? []) as Array<{ counter_number: number }>)[0]?.counter_number ?? 0) + 1;

  const { data: counter, error } = await supabaseAdmin
    .from("listing_offer_counters")
    .insert({
      listing_offer_id: listingOfferId,
      counter_number: nextNumber,
      direction: input.direction,
      price: input.price ?? null,
      changed_fields: input.changedFields ?? null,
      notes: input.notes ?? null,
    })
    .select("*")
    .single();
  if (error || !counter) throw new Error(error?.message ?? "Failed to record counter");

  const statusPatch: Partial<ListingOfferRow> & { updated_at: string } = {
    status: "countered",
    updated_at: new Date().toISOString(),
  };
  if (input.price != null) statusPatch.current_price = input.price;
  await supabaseAdmin.from("listing_offers").update(statusPatch).eq("id", listingOfferId);

  return counter as ListingOfferCounterRow;
}
