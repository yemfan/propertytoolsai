import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Subject-picker query helpers for the Quick Post wizard. Each
 * trigger maps to a SQL-side query that returns the relevant
 * "subjects" (listings, open houses, etc.) the agent might want
 * to post about.
 *
 * Phase 1A ships three triggers: new listing, open house, custom.
 * Phase 1B adds price-drop / just-sold / market-update / testimonial
 * (each is a different query + different prompt shape — easier to
 * land one trigger at a time so the wizard stays stable).
 *
 * `Subject` is intentionally narrow — the wizard renders these in
 * a list and passes the chosen id back to the draft endpoint, which
 * re-hydrates the full record to feed Claude. Keeping the wire
 * shape small avoids leaking listing internals into the client
 * and makes the picker fast even with hundreds of options.
 */

export type Trigger =
  | "new_listing"
  | "open_house"
  | "custom"
  // Phase 1B (declared here so the union doesn't churn when we
  // ship them, but the API rejects unknown triggers for now).
  | "price_drop"
  | "just_sold"
  | "market_update"
  | "testimonial"
  // Paste-an-address-or-URL trigger. Synthetic subject (no CRM
  // lookup); the lookup-property endpoint stitches a brief from
  // properties_warehouse + property_snapshots_warehouse.
  | "by_address";

export type SubjectKind =
  | "listing"
  | "open_house"
  | "transaction"
  | "market_update"
  | "testimonial"
  | "custom";

export type Subject = {
  /** Stable id for the wire — `listing:<uuid>` / `open_house:<uuid>` / `transaction:<uuid>` / `market_update` / `testimonial` / `custom`. */
  id: string;
  /** Picker label — first line bold. */
  label: string;
  /** Picker sub-label — second line, smaller. Address, date, etc. */
  sub: string | null;
  /** Tag the API will use to look up the underlying record. */
  kind: SubjectKind;
  /** Underlying record id (when kind references a CRM row). */
  refId: string | null;
};

/**
 * Triggers the API currently honors. Phase 1B added price_drop,
 * just_sold, market_update, and testimonial to the original
 * Phase 1A set (new_listing, open_house, custom).
 */
export const SUPPORTED_TRIGGERS: Trigger[] = [
  "new_listing",
  "open_house",
  "price_drop",
  "just_sold",
  "market_update",
  "testimonial",
  "custom",
  "by_address",
];

export function isSupportedTrigger(t: string): t is Trigger {
  return (SUPPORTED_TRIGGERS as string[]).includes(t);
}

/**
 * @deprecated Kept during the Phase 1A → 1B transition so existing
 * callers don't churn. Use `isSupportedTrigger`. Will be removed in
 * a follow-up cleanup once no callers reference it.
 */
export const isPhase1aTrigger = isSupportedTrigger;
/** @deprecated alias for SUPPORTED_TRIGGERS. */
export const PHASE_1A_TRIGGERS = SUPPORTED_TRIGGERS;

/**
 * Listings to surface for the "New listing" trigger — active listings
 * whose `listing_start_date` is within the last 60 days, newest first.
 * Falls back to created_at when listing_start_date is null (drafts /
 * legacy rows).
 *
 * The 60-day window is generous on purpose — agents often want to
 * re-share a listing weeks after it hit the market ("still available!"
 * style posts). The wizard can always sort to a specific listing.
 */
async function getNewListings(agentId: string): Promise<Subject[]> {
  const sixtyDaysAgoIso = new Date(Date.now() - 60 * 86_400_000).toISOString();
  const { data, error } = await supabaseAdmin
    .from("listings")
    .select(
      "id, property_address, city, state, list_price, listing_start_date, status, created_at",
    )
    .eq("agent_id", agentId)
    .in("status", ["active", "pending"])
    .or(`listing_start_date.gte.${sixtyDaysAgoIso.slice(0, 10)},created_at.gte.${sixtyDaysAgoIso}`)
    .order("listing_start_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(25);
  if (error) throw new Error(error.message);

  type Row = {
    id: string;
    property_address: string;
    city: string | null;
    state: string | null;
    list_price: number | null;
    listing_start_date: string | null;
    status: string;
    created_at: string;
  };

  return ((data as Row[] | null) ?? []).map((r) => ({
    id: `listing:${r.id}`,
    kind: "listing" as const,
    refId: r.id,
    label: r.property_address,
    sub: [
      [r.city, r.state].filter(Boolean).join(", ") || null,
      r.list_price != null ? `$${Number(r.list_price).toLocaleString()}` : null,
      r.listing_start_date ? `listed ${friendlyDate(r.listing_start_date)}` : null,
    ]
      .filter(Boolean)
      .join(" · "),
  }));
}

/**
 * Open houses to surface for the "Open house" trigger — scheduled
 * events from now → 21 days out, soonest first. 21 days covers
 * "this weekend" plus next-weekend planning posts.
 */
async function getUpcomingOpenHouses(agentId: string): Promise<Subject[]> {
  const nowIso = new Date().toISOString();
  const horizonIso = new Date(Date.now() + 21 * 86_400_000).toISOString();
  const { data, error } = await supabaseAdmin
    .from("open_houses")
    .select("id, property_address, city, state, list_price, start_at, end_at, status")
    .eq("agent_id", agentId)
    .gte("start_at", nowIso)
    .lte("start_at", horizonIso)
    .in("status", ["scheduled", "in_progress"])
    .order("start_at", { ascending: true })
    .limit(25);
  if (error) throw new Error(error.message);

  type Row = {
    id: string;
    property_address: string;
    city: string | null;
    state: string | null;
    list_price: number | null;
    start_at: string;
    end_at: string;
    status: string;
  };

  return ((data as Row[] | null) ?? []).map((r) => ({
    id: `open_house:${r.id}`,
    kind: "open_house" as const,
    refId: r.id,
    label: r.property_address,
    sub: [
      [r.city, r.state].filter(Boolean).join(", ") || null,
      friendlyDateTime(r.start_at),
      r.list_price != null ? `$${Number(r.list_price).toLocaleString()}` : null,
    ]
      .filter(Boolean)
      .join(" · "),
  }));
}

/**
 * Active/pending listings to surface for the "Price drop" trigger.
 * Without a price-history table we can't directly query "listings
 * with a price reduction" — the agent provides the prior price as
 * part of their brief in the wizard. We surface the same active
 * listings the new_listing trigger uses, just sorted differently
 * (oldest-listed first, since price-drop posts most commonly target
 * listings that have been on market a while).
 */
async function getPriceDropCandidates(agentId: string): Promise<Subject[]> {
  const { data, error } = await supabaseAdmin
    .from("listings")
    .select(
      "id, property_address, city, state, list_price, listing_start_date, status, created_at",
    )
    .eq("agent_id", agentId)
    .in("status", ["active", "pending"])
    .order("listing_start_date", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: true })
    .limit(25);
  if (error) throw new Error(error.message);

  type Row = {
    id: string;
    property_address: string;
    city: string | null;
    state: string | null;
    list_price: number | null;
    listing_start_date: string | null;
    created_at: string;
  };
  return ((data as Row[] | null) ?? []).map((r) => ({
    id: `listing:${r.id}`,
    kind: "listing" as const,
    refId: r.id,
    label: r.property_address,
    sub: [
      [r.city, r.state].filter(Boolean).join(", ") || null,
      r.list_price != null ? `Now $${Number(r.list_price).toLocaleString()}` : null,
      r.listing_start_date ? `listed ${friendlyDate(r.listing_start_date)}` : null,
    ]
      .filter(Boolean)
      .join(" · "),
  }));
}

/**
 * Transactions to surface for the "Just sold" trigger — closed
 * deals from the last 60 days. We display by `closing_date_actual`
 * (the real close date) when present, falling back to the
 * scheduled `closing_date` for deals where the actual hasn't been
 * stamped yet.
 *
 * Subject id is `transaction:<uuid>` — a new kind separate from
 * listing/open_house since the field shape differs (no MLS link;
 * purchase_price is what we celebrate, not list_price).
 */
async function getJustSoldTransactions(agentId: string): Promise<Subject[]> {
  const sixtyDaysAgoIso = new Date(Date.now() - 60 * 86_400_000).toISOString().slice(0, 10);
  const { data, error } = await supabaseAdmin
    .from("transactions")
    .select(
      "id, property_address, city, state, purchase_price, closing_date, closing_date_actual, transaction_type, status",
    )
    .eq("agent_id", agentId)
    .eq("status", "closed")
    .or(`closing_date_actual.gte.${sixtyDaysAgoIso},closing_date.gte.${sixtyDaysAgoIso}`)
    .order("closing_date_actual", { ascending: false, nullsFirst: false })
    .order("closing_date", { ascending: false })
    .limit(25);
  if (error) throw new Error(error.message);

  type Row = {
    id: string;
    property_address: string;
    city: string | null;
    state: string | null;
    purchase_price: number | null;
    closing_date: string | null;
    closing_date_actual: string | null;
    transaction_type: string;
  };
  return ((data as Row[] | null) ?? []).map((r) => {
    const closedOn = r.closing_date_actual ?? r.closing_date;
    return {
      id: `transaction:${r.id}`,
      kind: "transaction" as const,
      refId: r.id,
      label: r.property_address,
      sub: [
        [r.city, r.state].filter(Boolean).join(", ") || null,
        r.purchase_price != null
          ? `$${Number(r.purchase_price).toLocaleString()}`
          : null,
        closedOn ? `closed ${friendlyDate(closedOn)}` : null,
        sideLabel(r.transaction_type),
      ]
        .filter(Boolean)
        .join(" · "),
    };
  });
}

/**
 * Synthetic single-option subject for triggers that don't need a
 * CRM record to anchor the post (market updates, testimonials).
 * The trigger label varies but the picker UX is identical — single
 * pre-selected option that pipes the agent's brief to the AI.
 */
function syntheticSubject(
  kind: "market_update" | "testimonial",
  label: string,
  sub: string,
): Subject {
  return { id: kind, kind, refId: null, label, sub };
}

function sideLabel(t: string): string | null {
  if (t === "buyer_rep") return "buyer-side";
  if (t === "listing_rep") return "listing-side";
  if (t === "dual") return "dual-rep";
  return null;
}

/**
 * Single picker entry-point. Dispatches by trigger; non-CRM
 * triggers (custom / market_update / testimonial) return a single
 * synthetic option so the wizard UI doesn't need a separate branch.
 */
export async function getSubjectsForTrigger(
  trigger: Trigger,
  agentId: string,
): Promise<Subject[]> {
  if (trigger === "new_listing") return getNewListings(agentId);
  if (trigger === "open_house") return getUpcomingOpenHouses(agentId);
  if (trigger === "price_drop") return getPriceDropCandidates(agentId);
  if (trigger === "just_sold") return getJustSoldTransactions(agentId);
  if (trigger === "market_update") {
    return [
      syntheticSubject(
        "market_update",
        "Market update",
        "Share insight on rates, inventory, or local trends",
      ),
    ];
  }
  if (trigger === "testimonial") {
    return [
      syntheticSubject(
        "testimonial",
        "Client testimonial",
        "Paste a client quote — AI styles it for each platform",
      ),
    ];
  }
  if (trigger === "custom") {
    return [
      {
        id: "custom",
        kind: "custom",
        refId: null,
        label: "Custom topic",
        sub: "Write your own brief and let AI draft a post",
      },
    ];
  }
  if (trigger === "by_address") {
    return [
      {
        id: "by_address",
        kind: "custom",
        refId: null,
        label: "Paste an address or URL",
        sub: "Pull details from a listing on the MLS, Zillow, Redfin, etc.",
      },
    ];
  }
  // Defensive fallback — unknown trigger should have been rejected upstream.
  return [];
}

// ── Detail re-hydration (used by the draft route) ────────────────────

export type SubjectDetail =
  | {
      kind: "listing";
      refId: string;
      property_address: string;
      city: string | null;
      state: string | null;
      list_price: number | null;
      listing_start_date: string | null;
      mls_url: string | null;
      mls_number: string | null;
    }
  | {
      kind: "transaction";
      refId: string;
      property_address: string;
      city: string | null;
      state: string | null;
      purchase_price: number | null;
      closing_date_actual: string | null;
      closing_date: string | null;
      transaction_type: string;
    }
  | {
      kind: "market_update";
      refId: null;
      property_address: null;
      city: null;
      state: null;
      list_price: null;
    }
  | {
      kind: "testimonial";
      refId: null;
      property_address: null;
      city: null;
      state: null;
      list_price: null;
    }
  | {
      kind: "open_house";
      refId: string;
      property_address: string;
      city: string | null;
      state: string | null;
      list_price: number | null;
      start_at: string;
      end_at: string;
      mls_url: string | null;
    }
  | {
      kind: "custom";
      refId: null;
      property_address: null;
      city: null;
      state: null;
      list_price: null;
    };

export async function loadSubjectDetail(
  subjectId: string,
  agentId: string,
): Promise<SubjectDetail | null> {
  if (subjectId === "custom" || subjectId === "by_address") {
    // by_address routes through the same "custom" subject shape
    // because the brief carries the property details inline (no
    // CRM record id to attach to). The trigger value on the
    // request distinguishes for the AI tone prompt.
    return {
      kind: "custom",
      refId: null,
      property_address: null,
      city: null,
      state: null,
      list_price: null,
    };
  }
  if (subjectId === "market_update") {
    return {
      kind: "market_update",
      refId: null,
      property_address: null,
      city: null,
      state: null,
      list_price: null,
    };
  }
  if (subjectId === "testimonial") {
    return {
      kind: "testimonial",
      refId: null,
      property_address: null,
      city: null,
      state: null,
      list_price: null,
    };
  }
  if (subjectId.startsWith("transaction:")) {
    const id = subjectId.slice("transaction:".length);
    const { data } = await supabaseAdmin
      .from("transactions")
      .select(
        "id, agent_id, property_address, city, state, purchase_price, closing_date, closing_date_actual, transaction_type",
      )
      .eq("id", id)
      .eq("agent_id", agentId)
      .maybeSingle();
    if (!data) return null;
    const r = data as {
      property_address: string;
      city: string | null;
      state: string | null;
      purchase_price: number | null;
      closing_date: string | null;
      closing_date_actual: string | null;
      transaction_type: string;
    };
    return {
      kind: "transaction",
      refId: id,
      property_address: r.property_address,
      city: r.city,
      state: r.state,
      purchase_price: r.purchase_price,
      closing_date_actual: r.closing_date_actual,
      closing_date: r.closing_date,
      transaction_type: r.transaction_type,
    };
  }
  if (subjectId.startsWith("listing:")) {
    const id = subjectId.slice("listing:".length);
    const { data } = await supabaseAdmin
      .from("listings")
      .select(
        "id, agent_id, property_address, city, state, list_price, listing_start_date, mls_number, mls_url",
      )
      .eq("id", id)
      .eq("agent_id", agentId)
      .maybeSingle();
    if (!data) return null;
    const r = data as {
      property_address: string;
      city: string | null;
      state: string | null;
      list_price: number | null;
      listing_start_date: string | null;
      mls_number: string | null;
      mls_url: string | null;
    };
    return {
      kind: "listing",
      refId: id,
      property_address: r.property_address,
      city: r.city,
      state: r.state,
      list_price: r.list_price,
      listing_start_date: r.listing_start_date,
      mls_url: r.mls_url,
      mls_number: r.mls_number,
    };
  }
  if (subjectId.startsWith("open_house:")) {
    const id = subjectId.slice("open_house:".length);
    const { data } = await supabaseAdmin
      .from("open_houses")
      .select(
        "id, agent_id, property_address, city, state, list_price, start_at, end_at, mls_url",
      )
      .eq("id", id)
      .eq("agent_id", agentId)
      .maybeSingle();
    if (!data) return null;
    const r = data as {
      property_address: string;
      city: string | null;
      state: string | null;
      list_price: number | null;
      start_at: string;
      end_at: string;
      mls_url: string | null;
    };
    return {
      kind: "open_house",
      refId: id,
      property_address: r.property_address,
      city: r.city,
      state: r.state,
      list_price: r.list_price,
      start_at: r.start_at,
      end_at: r.end_at,
      mls_url: r.mls_url,
    };
  }
  return null;
}

// ── Formatting helpers ────────────────────────────────────────────────

function friendlyDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}

function friendlyDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
