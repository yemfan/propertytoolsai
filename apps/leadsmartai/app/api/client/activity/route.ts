import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/authFromRequest";
import { assertLeadAccessForUser } from "@/lib/clientPortalContext";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * GET /api/client/activity?leadId=<contact_id>
 *
 * Returns the client-visible activity for a single lead (contact):
 *   - showings they attended
 *   - offers that name them as the buyer (contact_id)
 *   - if they're a seller on any listing_rep / dual transaction,
 *     listing-side events (open-house visitor counts, listing-offer
 *     counts) on that transaction.
 *
 * Auth: `getUserFromRequest` resolves the portal user via their
 * Supabase session. `assertLeadAccessForUser` confirms the requested
 * leadId actually belongs to the user (email match). Anything else
 * 403s — so one client can't peek at another's data by guessing ids.
 *
 * Scope deliberately omits agent-facing fields (internal ids, listing
 * agent names/emails where unrelated, raw visitor PII) — only what a
 * buyer/seller should reasonably see about their own deal.
 */
export async function GET(req: Request) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const leadId = url.searchParams.get("leadId");
    if (!leadId) {
      return NextResponse.json({ ok: false, error: "leadId required" }, { status: 400 });
    }

    const lead = await assertLeadAccessForUser(user, leadId);
    if (!lead) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }

    // ── Showings (where this contact was the buyer) ───────────────
    const showings = await getShowings(leadId);
    // ── Offers (where this contact was the buyer) ────────────────
    const offers = await getOffers(leadId);
    // ── Listing-side events — only when this contact is the seller
    //    on an active listing_rep / dual transaction. ──────────────
    const listing = await getListingSummaryForSeller(leadId);

    return NextResponse.json({
      ok: true,
      showings,
      offers,
      listing,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error("GET /api/client/activity:", err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

// ── Scoped data fetchers ──────────────────────────────────────────

type ClientShowing = {
  id: string;
  propertyAddress: string;
  city: string | null;
  state: string | null;
  scheduledAt: string;
  status: string;
  feedbackRating: number | null;
  feedbackReaction: string | null;
};

async function getShowings(contactId: string): Promise<ClientShowing[]> {
  try {
    const { data } = await supabaseAdmin
      .from("showings")
      .select("id, property_address, city, state, scheduled_at, status")
      .eq("contact_id", contactId)
      .order("scheduled_at", { ascending: false })
      .limit(50);
    const rows = (data ?? []) as Array<{
      id: string;
      property_address: string;
      city: string | null;
      state: string | null;
      scheduled_at: string;
      status: string;
    }>;
    if (!rows.length) return [];

    // Best-effort: fetch feedback so the client can see their own reaction
    // rendered back. If the feedback join errors, just return showings.
    const ids = rows.map((r) => r.id);
    const { data: fbRows } = await supabaseAdmin
      .from("showing_feedback")
      .select("showing_id, rating, overall_reaction")
      .in("showing_id", ids);
    const feedbackByShowing = new Map<
      string,
      { rating: number | null; overall_reaction: string | null }
    >();
    for (const f of (fbRows ?? []) as Array<{
      showing_id: string;
      rating: number | null;
      overall_reaction: string | null;
    }>) {
      feedbackByShowing.set(f.showing_id, {
        rating: f.rating,
        overall_reaction: f.overall_reaction,
      });
    }

    return rows.map((r) => ({
      id: r.id,
      propertyAddress: r.property_address,
      city: r.city,
      state: r.state,
      scheduledAt: r.scheduled_at,
      status: r.status,
      feedbackRating: feedbackByShowing.get(r.id)?.rating ?? null,
      feedbackReaction: feedbackByShowing.get(r.id)?.overall_reaction ?? null,
    }));
  } catch (err) {
    // Missing-table / missing-column in this environment → empty list,
    // not an error. The portal should degrade gracefully if a feature
    // hasn't been rolled out everywhere.
    console.warn("client/activity getShowings:", err instanceof Error ? err.message : err);
    return [];
  }
}

type ClientOffer = {
  id: string;
  propertyAddress: string;
  offerPrice: number;
  currentPrice: number | null;
  status: string;
  submittedAt: string | null;
  acceptedAt: string | null;
  closedAt: string | null;
};

async function getOffers(contactId: string): Promise<ClientOffer[]> {
  try {
    const { data } = await supabaseAdmin
      .from("offers")
      .select(
        "id, property_address, offer_price, current_price, status, submitted_at, accepted_at, closed_at",
      )
      .eq("contact_id", contactId)
      .order("created_at", { ascending: false })
      .limit(50);
    const rows = (data ?? []) as Array<{
      id: string;
      property_address: string;
      offer_price: number;
      current_price: number | null;
      status: string;
      submitted_at: string | null;
      accepted_at: string | null;
      closed_at: string | null;
    }>;
    return rows.map((r) => ({
      id: r.id,
      propertyAddress: r.property_address,
      offerPrice: r.offer_price,
      currentPrice: r.current_price,
      status: r.status,
      submittedAt: r.submitted_at,
      acceptedAt: r.accepted_at,
      closedAt: r.closed_at,
    }));
  } catch (err) {
    console.warn("client/activity getOffers:", err instanceof Error ? err.message : err);
    return [];
  }
}

type ClientListingSummary = {
  transactionId: string;
  propertyAddress: string;
  listPrice: number | null;
  listingStartDate: string | null;
  daysOnMarket: number | null;
  visitorsTotal: number;
  offersCount: number;
  offersActive: number;
};

async function getListingSummaryForSeller(
  contactId: string,
): Promise<ClientListingSummary | null> {
  try {
    // A contact is the seller when there's an active listing_rep / dual
    // transaction whose contact_id = them.
    const { data: txRow } = await supabaseAdmin
      .from("transactions")
      .select("id, property_address, purchase_price, listing_start_date")
      .eq("contact_id", contactId)
      .in("transaction_type", ["listing_rep", "dual"])
      .in("status", ["active", "pending"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const tx = txRow as {
      id: string;
      property_address: string;
      purchase_price: number | null;
      listing_start_date: string | null;
    } | null;
    if (!tx) return null;

    const { count: visitorsTotal } = await countVisitors(tx.id);
    const { total: offersCount, active: offersActive } = await countListingOffers(tx.id);

    const dom =
      tx.listing_start_date != null ? daysBetween(tx.listing_start_date, today()) : null;

    return {
      transactionId: tx.id,
      propertyAddress: tx.property_address,
      listPrice: tx.purchase_price,
      listingStartDate: tx.listing_start_date,
      daysOnMarket: dom,
      visitorsTotal: visitorsTotal ?? 0,
      offersCount,
      offersActive,
    };
  } catch (err) {
    console.warn(
      "client/activity getListingSummary:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

async function countVisitors(transactionId: string): Promise<{ count: number }> {
  const { data: ohRows } = await supabaseAdmin
    .from("open_houses")
    .select("id")
    .eq("transaction_id", transactionId);
  const ohIds = ((ohRows ?? []) as Array<{ id: string }>).map((r) => r.id);
  if (ohIds.length === 0) return { count: 0 };
  const { count } = await supabaseAdmin
    .from("open_house_visitors")
    .select("*", { count: "exact", head: true })
    .in("open_house_id", ohIds);
  return { count: count ?? 0 };
}

async function countListingOffers(
  transactionId: string,
): Promise<{ total: number; active: number }> {
  const { data } = await supabaseAdmin
    .from("listing_offers")
    .select("status")
    .eq("transaction_id", transactionId);
  const rows = (data ?? []) as Array<{ status: string }>;
  const active = rows.filter((o) =>
    ["submitted", "countered"].includes(o.status),
  ).length;
  return { total: rows.length, active };
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(fromIso: string, toIso: string): number {
  const [fy, fm, fd] = fromIso.slice(0, 10).split("-").map(Number);
  const [ty, tm, td] = toIso.slice(0, 10).split("-").map(Number);
  const from = Date.UTC(fy, (fm ?? 1) - 1, fd ?? 1);
  const to = Date.UTC(ty, (tm ?? 1) - 1, td ?? 1);
  return Math.max(0, Math.round((to - from) / 86_400_000));
}
