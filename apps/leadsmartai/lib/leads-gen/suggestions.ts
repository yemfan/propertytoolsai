import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * "Suggested this week" data for the Generate Leads landing.
 *
 * Looks at the agent's CRM for the obvious post-worthy events and
 * surfaces up to one candidate per category as a deep-link card:
 *   - newest active listing from the last 7 days       → new_listing
 *   - earliest upcoming open house in the next 7 days  → open_house
 *   - most recently closed transaction (last 14 days)  → just_sold
 *
 * Each suggestion carries the trigger + subject id that the wizard
 * already understands, so the landing card just renders an anchor
 * with `?trigger=…&subjectId=…` and the wizard picks it up on mount.
 *
 * Deliberately ONE candidate per category, not a paginated list:
 * the surface is meant to nudge daily action ("here are three posts
 * you could draft in the next 5 minutes"), not be a content
 * calendar. The calendar view is a Phase 1B+ deliverable.
 */

export type Suggestion = {
  /** Stable key for React. */
  key: string;
  /** Trigger the wizard should load with (URL param). */
  trigger:
    | "new_listing"
    | "open_house"
    | "just_sold"
    | "price_drop"
    | "market_update"
    | "testimonial"
    | "custom";
  /** Subject id matching the wizard's loadSubjectDetail naming convention. */
  subjectId: string;
  /** Short headline rendered on the suggestion card. */
  title: string;
  /** Subtitle — context (price, date, address bits) under the title. */
  subtitle: string;
  /** Tiny tag rendered in the corner of the card. */
  badge: "new" | "this_week" | "celebrate";
};

/**
 * Builds the list of suggestions. Returns at most 3 — one per
 * category, in priority order (new listing > open house > just
 * sold). Empty array when nothing matches; the landing card
 * gracefully hides itself in that case.
 */
export async function getWeeklySuggestions(
  agentId: string,
): Promise<Suggestion[]> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const fourteenDaysAgo = new Date(Date.now() - 14 * 86_400_000).toISOString();
  const sevenDaysOut = new Date(Date.now() + 7 * 86_400_000).toISOString();
  const nowIso = new Date().toISOString();

  // Run all three queries in parallel — they're independent and
  // each capped to 1 row server-side.
  const [newListingRes, openHouseRes, justSoldRes] = await Promise.all([
    supabaseAdmin
      .from("listings")
      .select("id, property_address, city, state, list_price, listing_start_date, created_at, status")
      .eq("agent_id", agentId)
      .in("status", ["active", "pending"])
      .or(`listing_start_date.gte.${sevenDaysAgo.slice(0, 10)},created_at.gte.${sevenDaysAgo}`)
      .order("listing_start_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from("open_houses")
      .select("id, property_address, city, state, start_at, status")
      .eq("agent_id", agentId)
      .gte("start_at", nowIso)
      .lte("start_at", sevenDaysOut)
      .in("status", ["scheduled", "in_progress"])
      .order("start_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from("transactions")
      .select("id, property_address, city, state, purchase_price, closing_date_actual, closing_date, status")
      .eq("agent_id", agentId)
      .eq("status", "closed")
      .or(`closing_date_actual.gte.${fourteenDaysAgo.slice(0, 10)},closing_date.gte.${fourteenDaysAgo.slice(0, 10)}`)
      .order("closing_date_actual", { ascending: false, nullsFirst: false })
      .order("closing_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const out: Suggestion[] = [];

  const newListing = newListingRes.data as {
    id: string;
    property_address: string;
    city: string | null;
    state: string | null;
    list_price: number | null;
    listing_start_date: string | null;
  } | null;
  if (newListing) {
    out.push({
      key: `new_listing:${newListing.id}`,
      trigger: "new_listing",
      subjectId: `listing:${newListing.id}`,
      title: `New listing — ${newListing.property_address}`,
      subtitle: [
        [newListing.city, newListing.state].filter(Boolean).join(", ") || null,
        newListing.list_price != null
          ? `$${Number(newListing.list_price).toLocaleString()}`
          : null,
        newListing.listing_start_date
          ? `listed ${friendlyDate(newListing.listing_start_date)}`
          : null,
      ]
        .filter(Boolean)
        .join(" · "),
      badge: "new",
    });
  }

  const openHouse = openHouseRes.data as {
    id: string;
    property_address: string;
    city: string | null;
    state: string | null;
    start_at: string;
  } | null;
  if (openHouse) {
    out.push({
      key: `open_house:${openHouse.id}`,
      trigger: "open_house",
      subjectId: `open_house:${openHouse.id}`,
      title: `Open house — ${openHouse.property_address}`,
      subtitle: [
        [openHouse.city, openHouse.state].filter(Boolean).join(", ") || null,
        friendlyDateTime(openHouse.start_at),
      ]
        .filter(Boolean)
        .join(" · "),
      badge: "this_week",
    });
  }

  const justSold = justSoldRes.data as {
    id: string;
    property_address: string;
    city: string | null;
    state: string | null;
    purchase_price: number | null;
    closing_date_actual: string | null;
    closing_date: string | null;
  } | null;
  if (justSold) {
    const closedOn = justSold.closing_date_actual ?? justSold.closing_date;
    out.push({
      key: `just_sold:${justSold.id}`,
      trigger: "just_sold",
      subjectId: `transaction:${justSold.id}`,
      title: `Just closed — ${justSold.property_address}`,
      subtitle: [
        [justSold.city, justSold.state].filter(Boolean).join(", ") || null,
        justSold.purchase_price != null
          ? `$${Number(justSold.purchase_price).toLocaleString()}`
          : null,
        closedOn ? `closed ${friendlyDate(closedOn)}` : null,
      ]
        .filter(Boolean)
        .join(" · "),
      badge: "celebrate",
    });
  }

  return out;
}

function friendlyDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}

function friendlyDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-US", {
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
