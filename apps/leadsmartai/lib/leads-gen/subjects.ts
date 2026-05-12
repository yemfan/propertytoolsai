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
  | "testimonial";

export type Subject = {
  /** Stable id for the wire — `listing:<uuid>` / `open_house:<uuid>` / `custom`. */
  id: string;
  /** Picker label — first line bold. */
  label: string;
  /** Picker sub-label — second line, smaller. Address, date, etc. */
  sub: string | null;
  /** Tag the API will use to look up the underlying record. */
  kind: "listing" | "open_house" | "custom";
  /** Underlying record id (when kind != "custom"). */
  refId: string | null;
};

/**
 * Phase 1A trigger menu — these are the only triggers the API
 * currently honors. The remaining four (price_drop, just_sold,
 * market_update, testimonial) are scaffolded in the `Trigger`
 * union but rejected at the route layer until Phase 1B.
 */
export const PHASE_1A_TRIGGERS: Trigger[] = [
  "new_listing",
  "open_house",
  "custom",
];

export function isPhase1aTrigger(t: string): t is Trigger {
  return (PHASE_1A_TRIGGERS as string[]).includes(t);
}

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
 * Single picker entry-point. Dispatches by trigger; "custom" returns
 * a single synthetic option so the wizard UI doesn't need a separate
 * branch.
 */
export async function getSubjectsForTrigger(
  trigger: Trigger,
  agentId: string,
): Promise<Subject[]> {
  if (trigger === "new_listing") return getNewListings(agentId);
  if (trigger === "open_house") return getUpcomingOpenHouses(agentId);
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
  // Phase 1B triggers — the route currently rejects these before
  // calling in. Returning [] keeps the picker safe if someone wires
  // them up in the client ahead of the backend.
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
  if (subjectId === "custom") {
    return {
      kind: "custom",
      refId: null,
      property_address: null,
      city: null,
      state: null,
      list_price: null,
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
