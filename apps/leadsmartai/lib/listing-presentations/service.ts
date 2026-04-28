import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  DEFAULT_SECTIONS,
  isPresentationReady,
  normalizeSections,
  type ReadinessResult,
  type Section,
} from "./sections";
import { generateShareToken, hashShareToken } from "./shareToken";

/**
 * Server-side service for listing presentations.
 *
 * Bypasses RLS via the service-role client because each route
 * is responsible for authorizing the calling agent. The public
 * view path uses `loadByShareToken` — no agent auth, just the
 * token from the seller-facing link.
 */

export type ListingPresentation = {
  id: string;
  agentId: string;
  contactId: string | null;
  propertyAddress: string;
  propertyCity: string | null;
  propertyState: string | null;
  propertyZip: string | null;
  suggestedListPrice: number | null;
  suggestedListLow: number | null;
  suggestedListHigh: number | null;
  sections: Section[];
  status: "draft" | "ready" | "shared" | "closed" | "archived";
  hasShareToken: boolean;
  sharedWithEmail: string | null;
  sharedAt: string | null;
  viewedAt: string | null;
  viewCount: number;
  renderedPdfUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export async function createPresentation(args: {
  agentId: string;
  contactId?: string | null;
  propertyAddress: string;
  propertyCity?: string | null;
  propertyState?: string | null;
  propertyZip?: string | null;
}): Promise<ListingPresentation> {
  const { data, error } = await supabaseAdmin
    .from("listing_presentations")
    .insert({
      agent_id: args.agentId,
      contact_id: args.contactId ?? null,
      property_address: args.propertyAddress.trim(),
      property_city: args.propertyCity ?? null,
      property_state: args.propertyState ?? null,
      property_zip: args.propertyZip ?? null,
      sections: DEFAULT_SECTIONS,
      status: "draft",
    })
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create presentation");
  }
  return mapRow(data as Record<string, unknown>);
}

export async function listForAgent(
  agentId: string,
): Promise<ListingPresentation[]> {
  const { data, error } = await supabaseAdmin
    .from("listing_presentations")
    .select("*")
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false });
  if (error) {
    console.warn("[listing-presentations] listForAgent failed:", error.message);
    return [];
  }
  return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
}

export async function getPresentation(
  id: string,
): Promise<ListingPresentation | null> {
  const { data, error } = await supabaseAdmin
    .from("listing_presentations")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return mapRow(data as Record<string, unknown>);
}

/**
 * Update the sections array. Pass-through to normalizeSections
 * so legacy / malformed input gets cleaned up automatically.
 */
export async function updateSections(args: {
  id: string;
  sections: unknown;
}): Promise<ListingPresentation | null> {
  const cleaned = normalizeSections(args.sections);
  const { data, error } = await supabaseAdmin
    .from("listing_presentations")
    .update({ sections: cleaned })
    .eq("id", args.id)
    .select("*")
    .single();
  if (error || !data) return null;
  return mapRow(data as Record<string, unknown>);
}

export async function updatePricing(args: {
  id: string;
  suggestedListPrice: number | null;
  suggestedListLow?: number | null;
  suggestedListHigh?: number | null;
}): Promise<ListingPresentation | null> {
  const { data, error } = await supabaseAdmin
    .from("listing_presentations")
    .update({
      suggested_list_price: args.suggestedListPrice,
      suggested_list_low: args.suggestedListLow ?? null,
      suggested_list_high: args.suggestedListHigh ?? null,
    })
    .eq("id", args.id)
    .select("*")
    .single();
  if (error || !data) return null;
  return mapRow(data as Record<string, unknown>);
}

/**
 * Generate a fresh share token, mark the presentation as 'shared',
 * and return the raw token so the caller can embed it in the
 * outbound link.
 *
 * Rotating the token (calling this twice) invalidates any prior
 * link — useful if the agent shared with the wrong email and
 * wants to make sure the old recipient can't view anymore.
 */
export async function shareWithToken(args: {
  id: string;
  sharedWithEmail?: string | null;
  nowIso?: string;
}): Promise<{ rawToken: string; presentation: ListingPresentation } | null> {
  const nowIso = args.nowIso ?? new Date().toISOString();
  const { rawToken, tokenHash } = generateShareToken();
  const { data, error } = await supabaseAdmin
    .from("listing_presentations")
    .update({
      share_token_hash: tokenHash,
      shared_with_email: args.sharedWithEmail ?? null,
      shared_at: nowIso,
      status: "shared",
    })
    .eq("id", args.id)
    .select("*")
    .single();
  if (error || !data) return null;
  return { rawToken, presentation: mapRow(data as Record<string, unknown>) };
}

/**
 * Public-page lookup. The seller pasted the raw token from their
 * link; we hash and find the presentation. Returns null when the
 * token doesn't match — the public route surfaces a 404 page.
 */
export async function loadByShareToken(
  rawToken: string,
): Promise<ListingPresentation | null> {
  const tokenHash = hashShareToken(rawToken);
  const { data } = await supabaseAdmin
    .from("listing_presentations")
    .select("*")
    .eq("share_token_hash", tokenHash)
    .maybeSingle();
  if (!data) return null;
  return mapRow(data as Record<string, unknown>);
}

/**
 * Record that the seller viewed the share link. Idempotent on
 * the timestamp side — first view stamps `viewed_at`; every view
 * (including repeats) increments `view_count`.
 */
export async function recordShareView(args: {
  rawToken: string;
  nowIso?: string;
}): Promise<boolean> {
  const nowIso = args.nowIso ?? new Date().toISOString();
  const tokenHash = hashShareToken(rawToken(args));
  const { data: row } = await supabaseAdmin
    .from("listing_presentations")
    .select("id, viewed_at, view_count")
    .eq("share_token_hash", tokenHash)
    .maybeSingle();
  if (!row) return false;
  const r = row as { id: string; viewed_at: string | null; view_count: number };
  await supabaseAdmin
    .from("listing_presentations")
    .update({
      viewed_at: r.viewed_at ?? nowIso,
      view_count: (r.view_count ?? 0) + 1,
    })
    .eq("id", r.id);
  return true;
}

function rawToken(args: { rawToken: string }): string {
  return args.rawToken;
}

/**
 * Helper that combines getPresentation + the readiness check —
 * useful for the agent dashboard ("ready to share" badge).
 */
export async function getReadiness(
  id: string,
  hasCmaData: boolean,
  hasTestimonials: boolean,
): Promise<ReadinessResult | null> {
  const p = await getPresentation(id);
  if (!p) return null;
  return isPresentationReady({
    propertyAddress: p.propertyAddress,
    suggestedListPrice: p.suggestedListPrice,
    sections: p.sections,
    hasCmaData,
    hasTestimonials,
  });
}

// ── row mapper ──────────────────────────────────────────────────

function mapRow(row: Record<string, unknown>): ListingPresentation {
  return {
    id: String(row.id ?? ""),
    agentId: String(row.agent_id ?? ""),
    contactId: (row.contact_id as string | null) ?? null,
    propertyAddress: String(row.property_address ?? ""),
    propertyCity: (row.property_city as string | null) ?? null,
    propertyState: (row.property_state as string | null) ?? null,
    propertyZip: (row.property_zip as string | null) ?? null,
    suggestedListPrice: parseNumeric(row.suggested_list_price),
    suggestedListLow: parseNumeric(row.suggested_list_low),
    suggestedListHigh: parseNumeric(row.suggested_list_high),
    sections: normalizeSections(row.sections),
    status: (row.status as ListingPresentation["status"]) ?? "draft",
    hasShareToken: Boolean(row.share_token_hash),
    sharedWithEmail: (row.shared_with_email as string | null) ?? null,
    sharedAt: (row.shared_at as string | null) ?? null,
    viewedAt: (row.viewed_at as string | null) ?? null,
    viewCount:
      typeof row.view_count === "number" ? row.view_count : Number(row.view_count ?? 0),
    renderedPdfUrl: (row.rendered_pdf_url as string | null) ?? null,
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

function parseNumeric(raw: unknown): number | null {
  if (raw == null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}
