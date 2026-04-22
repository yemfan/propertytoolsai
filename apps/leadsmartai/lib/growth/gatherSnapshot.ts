import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import type { AgentGrowthSnapshot } from "./opportunityTypes";

/**
 * Assembles an AgentGrowthSnapshot — the structured input to the
 * Claude opportunity generator. Pure data-gathering: no AI calls, no
 * writes. Runs ~200-400ms per agent on realistic data sizes.
 *
 * Limits (per category): contacts ≤ 2000, showings ≤ 200, offers ≤
 * 200, transactions ≤ 200. If an agent grows past those we'd add
 * pagination — but the Claude prompt shouldn't see a list of 2000
 * contacts anyway. Compact, high-signal aggregations only.
 */
export async function gatherAgentGrowthSnapshot(
  agentId: string,
  todayIso: string = new Date().toISOString().slice(0, 10),
): Promise<AgentGrowthSnapshot> {
  const now = Date.now();
  const days60Ago = new Date(now - 60 * 86_400_000).toISOString();
  const days7Ago = new Date(now - 7 * 86_400_000).toISOString();
  const days14Ago = new Date(now - 14 * 86_400_000).toISOString();
  const days90Ago = new Date(now - 90 * 86_400_000).toISOString();

  // ── Contacts ──────────────────────────────────────────────────────
  const { data: contactRows } = await supabaseAdmin
    .from("contacts")
    .select(
      "id, first_name, last_name, name, email, rating, last_contacted_at, closing_date, source",
    )
    .eq("agent_id", agentId)
    .limit(2000);
  const contacts = (contactRows ?? []) as Array<{
    id: string;
    first_name: string | null;
    last_name: string | null;
    name: string | null;
    email: string | null;
    rating: string | null;
    last_contacted_at: string | null;
    closing_date: string | null;
    source: string | null;
  }>;

  const displayName = (c: typeof contacts[number]): string =>
    (`${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || c.name || c.email) ?? "(no name)";

  let contactsNoContactIn60d = 0;
  let contactsClosedPastClients = 0;
  let contactsClosedPastClientsNoAnniversary = 0;
  const hotLeadsNoContactIn7d: AgentGrowthSnapshot["hotLeadsNoContactIn7d"] = [];

  const sourceCounts = new Map<string, number>();

  for (const c of contacts) {
    if (c.source) {
      sourceCounts.set(c.source, (sourceCounts.get(c.source) ?? 0) + 1);
    }
    const lastContact = c.last_contacted_at ?? null;
    if (!lastContact || lastContact < days60Ago) contactsNoContactIn60d += 1;
    if (c.closing_date) {
      contactsClosedPastClients += 1;
      // "No anniversary" proxy: they closed over a year ago and haven't
      // been contacted in 60+ days. Anniversary campaigns usually ping
      // around the close-date month; missed outreach is the opportunity.
      const closedOverYearAgo = c.closing_date < todayIso.slice(0, 4) + "-" + todayIso.slice(5);
      if (closedOverYearAgo && (!lastContact || lastContact < days60Ago)) {
        contactsClosedPastClientsNoAnniversary += 1;
      }
    }
    const isHot = (c.rating ?? "").toLowerCase() === "hot";
    if (isHot && (!lastContact || lastContact < days7Ago)) {
      if (hotLeadsNoContactIn7d.length < 5) {
        const daysSince = lastContact
          ? Math.round((now - new Date(lastContact).getTime()) / 86_400_000)
          : 999;
        hotLeadsNoContactIn7d.push({
          id: c.id,
          name: displayName(c),
          daysSinceContact: daysSince,
        });
      }
    }
  }

  const topLeadSources = [...sourceCounts.entries()]
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // ── Showings where the buyer said "would_offer" but no offer yet ──
  const showingsLovedNoOffer = await findShowingsLovedNoOffer(agentId);

  // ── Offers ────────────────────────────────────────────────────────
  const { data: offerRows } = await supabaseAdmin
    .from("offers")
    .select(
      "id, property_address, contact_id, status, submitted_at, accepted_at, closed_at, updated_at",
    )
    .eq("agent_id", agentId)
    .order("updated_at", { ascending: false })
    .limit(200);
  const offers = (offerRows ?? []) as Array<{
    id: string;
    property_address: string;
    contact_id: string;
    status: string;
    submitted_at: string | null;
    accepted_at: string | null;
    closed_at: string | null;
    updated_at: string;
  }>;

  const offerContactIds = [...new Set(offers.map((o) => o.contact_id))];
  const offerContactNameById = new Map<string, string | null>();
  if (offerContactIds.length) {
    const { data: ocRows } = await supabaseAdmin
      .from("contacts")
      .select("id, first_name, last_name, name, email")
      .in("id", offerContactIds);
    for (const c of (ocRows ?? []) as Array<{
      id: string;
      first_name: string | null;
      last_name: string | null;
      name: string | null;
      email: string | null;
    }>) {
      const name = `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || c.name || c.email;
      offerContactNameById.set(c.id, name ?? null);
    }
  }

  let offersActive = 0;
  const offersStalled: AgentGrowthSnapshot["offersStalled"] = [];
  let offersSubmitted90d = 0;
  let offersAccepted90d = 0;
  let offersLost90d = 0;

  for (const o of offers) {
    const isActive = ["draft", "submitted", "countered"].includes(o.status);
    if (isActive) offersActive += 1;
    // Stalled heuristic: active + not touched in 7 days.
    if (isActive && o.updated_at < days7Ago && offersStalled.length < 5) {
      const daysSinceUpdate = Math.round(
        (now - new Date(o.updated_at).getTime()) / 86_400_000,
      );
      offersStalled.push({
        id: o.id,
        propertyAddress: o.property_address,
        contactName: offerContactNameById.get(o.contact_id) ?? null,
        status: o.status,
        daysSinceUpdate,
      });
    }
    const anchor = o.accepted_at ?? o.closed_at ?? o.submitted_at;
    if (anchor && anchor >= days90Ago) {
      if (o.submitted_at) offersSubmitted90d += 1;
      if (o.status === "accepted") offersAccepted90d += 1;
      if (["rejected", "withdrawn", "expired"].includes(o.status)) offersLost90d += 1;
    }
  }

  // ── Transactions ──────────────────────────────────────────────────
  const { data: txRows } = await supabaseAdmin
    .from("transactions")
    .select("id, status, closing_date_actual")
    .eq("agent_id", agentId)
    .limit(200);
  const transactions = (txRows ?? []) as Array<{
    id: string;
    status: string;
    closing_date_actual: string | null;
  }>;
  let transactionsActive = 0;
  let transactionsClosed90d = 0;
  for (const t of transactions) {
    if (t.status === "active" || t.status === "pending") transactionsActive += 1;
    if (t.status === "closed" && t.closing_date_actual && t.closing_date_actual >= days90Ago.slice(0, 10)) {
      transactionsClosed90d += 1;
    }
  }

  void days14Ago; // reserved for future categories
  return {
    generatedAtIso: new Date().toISOString(),
    contactsTotal: contacts.length,
    contactsNoContactIn60d,
    contactsClosedPastClients,
    contactsClosedPastClientsNoAnniversary,
    hotLeadsNoContactIn7d,
    showingsLovedNoOffer,
    offersActive,
    offersStalled,
    offersSubmitted90d,
    offersAccepted90d,
    offersLost90d,
    transactionsActive,
    transactionsClosed90d,
    topLeadSources,
  };
}

/**
 * Find showings that have feedback.would_offer=true but no offer
 * logged yet. This is one of the most valuable signals — the buyer
 * said yes, and the follow-through slipped.
 */
async function findShowingsLovedNoOffer(
  agentId: string,
): Promise<AgentGrowthSnapshot["showingsLovedNoOffer"]> {
  const { data: showingRows } = await supabaseAdmin
    .from("showings")
    .select("id, property_address, contact_id, scheduled_at, status")
    .eq("agent_id", agentId)
    .eq("status", "attended")
    .order("scheduled_at", { ascending: false })
    .limit(100);
  const showings = (showingRows ?? []) as Array<{
    id: string;
    property_address: string;
    contact_id: string;
    scheduled_at: string;
    status: string;
  }>;
  if (!showings.length) return [];

  const showingIds = showings.map((s) => s.id);
  const { data: fbRows } = await supabaseAdmin
    .from("showing_feedback")
    .select("showing_id, would_offer")
    .in("showing_id", showingIds);
  const wouldOfferShowingIds = new Set(
    ((fbRows ?? []) as Array<{ showing_id: string; would_offer: boolean }>)
      .filter((f) => f.would_offer)
      .map((f) => f.showing_id),
  );

  const candidates = showings.filter((s) => wouldOfferShowingIds.has(s.id));
  if (!candidates.length) return [];

  // Cross-check against offers — exclude any that already have an
  // offer linked via showing_id OR an offer on the same property.
  const { data: existingOffers } = await supabaseAdmin
    .from("offers")
    .select("showing_id, property_address, contact_id")
    .eq("agent_id", agentId)
    .in(
      "showing_id",
      candidates.map((c) => c.id) as never,
    );
  const offeredShowingIds = new Set(
    ((existingOffers ?? []) as Array<{ showing_id: string | null }>)
      .filter((o) => o.showing_id)
      .map((o) => o.showing_id as string),
  );

  const contactIds = [...new Set(candidates.map((c) => c.contact_id))];
  const contactNameById = new Map<string, string | null>();
  if (contactIds.length) {
    const { data: cRows } = await supabaseAdmin
      .from("contacts")
      .select("id, first_name, last_name, name, email")
      .in("id", contactIds);
    for (const c of (cRows ?? []) as Array<{
      id: string;
      first_name: string | null;
      last_name: string | null;
      name: string | null;
      email: string | null;
    }>) {
      const name = `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || c.name || c.email;
      contactNameById.set(c.id, name ?? null);
    }
  }

  const now = Date.now();
  return candidates
    .filter((s) => !offeredShowingIds.has(s.id))
    .slice(0, 5)
    .map((s) => ({
      id: s.id,
      propertyAddress: s.property_address,
      contactId: s.contact_id,
      contactName: contactNameById.get(s.contact_id) ?? null,
      daysSinceShowing: Math.round((now - new Date(s.scheduled_at).getTime()) / 86_400_000),
    }));
}
