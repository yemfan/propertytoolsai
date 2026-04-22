import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import type {
  OpenHouseRow,
  OpenHouseVisitorRow,
  VisitorBuyerStatus,
  VisitorTimeline,
} from "./types";

/**
 * Public (unauthenticated) service for the open-house sign-in flow.
 *
 * The only auth is the 12-char `signin_slug` — which is effectively a
 * capability token. Anyone with the URL can sign in. That's by
 * design: the agent shares a QR code on an iPad at the door.
 *
 * Trust boundary:
 *   * NEVER expose agent_id or any fields an authed agent would
 *     care about keeping private.
 *   * Return ONLY the fields the public form + post-signin confirmation
 *     page needs: property address, start/end, agent first name.
 *   * Writes are scoped to a visitor row tied to this open_house_id.
 *     Abuse surface is limited to dumping junk visitor rows — not
 *     great, but not a security hole. Add hCaptcha when it becomes a
 *     real problem.
 *
 * Visitor → contact intake: if the visitor has email or phone AND
 * marketing_consent=true AND is_buyer_agented=false, we upsert a
 * contacts row with source='Open House'. If the visitor has their own
 * agent, we capture them for the agent's records but do NOT create a
 * CRM contact — doing so would breach Realtor® code-of-ethics.
 */

export type PublicOpenHouseInfo = {
  slug: string;
  propertyAddress: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  listPrice: number | null;
  mlsUrl: string | null;
  startAt: string;
  endAt: string;
  hostAgentFirstName: string | null;
  hostAgentHeadline: string | null;
  status: OpenHouseRow["status"];
};

export async function getPublicOpenHouseBySlug(
  slug: string,
): Promise<PublicOpenHouseInfo | null> {
  const { data, error } = await supabaseAdmin
    .from("open_houses")
    .select(
      "id, signin_slug, agent_id, property_address, city, state, zip, list_price, mls_url, start_at, end_at, status",
    )
    .eq("signin_slug", slug)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as OpenHouseRow;

  // Pull agent's first name for a personal touch on the page. Never
  // return agent_id or email to the public. Best-effort — if the agent
  // row fetch fails, we just omit it.
  let firstName: string | null = null;
  let headline: string | null = null;
  try {
    const { data: agentRow } = await supabaseAdmin
      .from("agents")
      .select("first_name, brokerage_name")
      .eq("id", row.agent_id)
      .maybeSingle();
    const a = agentRow as { first_name: string | null; brokerage_name: string | null } | null;
    firstName = a?.first_name ?? null;
    headline = a?.brokerage_name ?? null;
  } catch {
    // non-fatal
  }

  return {
    slug: row.signin_slug,
    propertyAddress: row.property_address,
    city: row.city,
    state: row.state,
    zip: row.zip,
    listPrice: row.list_price,
    mlsUrl: row.mls_url,
    startAt: row.start_at,
    endAt: row.end_at,
    hostAgentFirstName: firstName,
    hostAgentHeadline: headline,
    status: row.status,
  };
}

// ── Sign-in write path ────────────────────────────────────────────────

export type PublicSigninInput = {
  slug: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  isBuyerAgented: boolean;
  buyerAgentName: string | null;
  buyerAgentBrokerage: string | null;
  timeline: VisitorTimeline | null;
  buyerStatus: VisitorBuyerStatus | null;
  marketingConsent: boolean;
  notes: string | null;
};

export type PublicSigninResult = {
  visitorId: string;
  contactCreated: boolean;
};

export async function recordPublicSignin(
  input: PublicSigninInput,
): Promise<PublicSigninResult> {
  if (!input.slug) throw new Error("Missing slug");

  // Soft validation: must provide at least name or email or phone.
  // Empty submissions are noise, not useful leads.
  if (!(input.name || input.email || input.phone)) {
    throw new Error("Please enter at least your name, email, or phone.");
  }

  // Look up the open house by slug. 404 if not found or cancelled.
  const { data: ohData, error } = await supabaseAdmin
    .from("open_houses")
    .select("id, agent_id, status, property_address, start_at, end_at")
    .eq("signin_slug", input.slug)
    .maybeSingle();
  if (error || !ohData) throw new Error("Open house not found");
  const oh = ohData as Pick<
    OpenHouseRow,
    "id" | "agent_id" | "status" | "property_address" | "start_at" | "end_at"
  >;
  if (oh.status === "cancelled") {
    throw new Error("This open house has been cancelled.");
  }

  // Insert the visitor row.
  const { data: visitorData, error: visitorErr } = await supabaseAdmin
    .from("open_house_visitors")
    .insert({
      open_house_id: oh.id,
      agent_id: oh.agent_id,
      name: trim(input.name),
      email: trim(input.email),
      phone: trim(input.phone),
      is_buyer_agented: input.isBuyerAgented,
      buyer_agent_name: input.isBuyerAgented ? trim(input.buyerAgentName) : null,
      buyer_agent_brokerage: input.isBuyerAgented ? trim(input.buyerAgentBrokerage) : null,
      timeline: input.timeline,
      buyer_status: input.buyerStatus,
      marketing_consent: input.marketingConsent,
      notes: trim(input.notes),
    })
    .select("*")
    .single();
  if (visitorErr || !visitorData) {
    throw new Error(visitorErr?.message ?? "Failed to record sign-in");
  }
  const visitor = visitorData as OpenHouseVisitorRow;

  // Conditionally upsert a CRM contact. Skip when:
  //   - Visitor is already agented (ethics).
  //   - No marketing consent (no legal basis for outreach).
  //   - No email AND no phone (can't follow up anyway).
  let contactCreated = false;
  const hasContactReach = Boolean(visitor.email || visitor.phone);
  if (!input.isBuyerAgented && input.marketingConsent && hasContactReach) {
    try {
      const contactId = await upsertContactFromVisitor(oh.agent_id, visitor, oh.property_address);
      if (contactId) {
        await supabaseAdmin
          .from("open_house_visitors")
          .update({ contact_id: contactId })
          .eq("id", visitor.id);
        contactCreated = true;
      }
    } catch (err) {
      // Don't fail the sign-in if contact intake fails — the visitor
      // row still carries all the info, and an agent can manually
      // convert later.
      console.error(
        "[open-houses.publicService] contact upsert failed:",
        err instanceof Error ? err.message : err,
      );
    }
  }

  return { visitorId: visitor.id, contactCreated };
}

async function upsertContactFromVisitor(
  agentId: string,
  visitor: OpenHouseVisitorRow,
  propertyAddress: string,
): Promise<string | null> {
  // De-dupe by email or phone within the agent's contacts. First match wins.
  const orParts: string[] = [];
  if (visitor.email) orParts.push(`email.eq.${visitor.email}`);
  if (visitor.phone) orParts.push(`phone.eq.${visitor.phone}`);
  if (visitor.phone) orParts.push(`phone_number.eq.${visitor.phone}`);

  if (orParts.length) {
    const { data: existing } = await supabaseAdmin
      .from("contacts")
      .select("id")
      .eq("agent_id", agentId)
      .or(orParts.join(","))
      .limit(1)
      .maybeSingle();
    const existingId = (existing as { id: string } | null)?.id ?? null;
    if (existingId) {
      // Bump source/notes without clobbering richer existing data.
      await supabaseAdmin
        .from("contacts")
        .update({
          last_contacted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingId);
      return existingId;
    }
  }

  // Split the name heuristically — "First Last" with leftover → last_name
  // gets everything after the first token.
  const nameParts = (visitor.name ?? "").trim().split(/\s+/).filter(Boolean);
  const firstName = nameParts[0] ?? null;
  const lastName = nameParts.slice(1).join(" ") || null;

  const { data: inserted, error } = await supabaseAdmin
    .from("contacts")
    .insert({
      agent_id: agentId,
      first_name: firstName,
      last_name: lastName,
      name: visitor.name,
      email: visitor.email,
      phone: visitor.phone,
      phone_number: visitor.phone,
      source: "Open House",
      // Timeline "now" or "3_6_months" → hot. Otherwise warm.
      rating: visitor.timeline === "now" || visitor.timeline === "3_6_months" ? "hot" : "warm",
      property_address: propertyAddress,
      notes: visitor.notes,
      last_contacted_at: new Date().toISOString(),
    })
    .select("id")
    .maybeSingle();
  if (error) {
    console.error(
      "[open-houses.publicService] contact insert error:",
      error.message,
    );
    return null;
  }
  return (inserted as { id: string } | null)?.id ?? null;
}

function trim(v: string | null | undefined): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length ? t : null;
}
