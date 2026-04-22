import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { generateOpenHouseSlug } from "./slug";
import type {
  OpenHouseListItem,
  OpenHouseRow,
  OpenHouseStatus,
  OpenHouseVisitorRow,
} from "./types";

/**
 * Agent-scoped service for the Open House feature.
 *
 * Visitor creation lives in `publicService.ts` — that path is
 * explicitly unauthenticated (public QR code), so keeping it in a
 * separate module makes the trust boundary obvious.
 */

// ── CREATE ────────────────────────────────────────────────────────────

export type CreateOpenHouseInput = {
  agentId: string;
  propertyAddress: string;
  startAt: string;
  endAt: string;
  transactionId?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  mlsNumber?: string | null;
  mlsUrl?: string | null;
  listPrice?: number | null;
  hostNotes?: string | null;
};

export async function createOpenHouse(input: CreateOpenHouseInput): Promise<OpenHouseRow> {
  // Retry loop for the (vanishingly unlikely) slug collision. Max 3 tries —
  // if we hit 3 collisions something much weirder is going on.
  for (let attempt = 0; attempt < 3; attempt++) {
    const slug = generateOpenHouseSlug();
    const { data, error } = await supabaseAdmin
      .from("open_houses")
      .insert({
        agent_id: input.agentId,
        transaction_id: input.transactionId ?? null,
        property_address: input.propertyAddress,
        city: input.city ?? null,
        state: input.state ?? null,
        zip: input.zip ?? null,
        mls_number: input.mlsNumber ?? null,
        mls_url: input.mlsUrl ?? null,
        list_price: input.listPrice ?? null,
        start_at: input.startAt,
        end_at: input.endAt,
        signin_slug: slug,
        host_notes: input.hostNotes ?? null,
      })
      .select("*")
      .single();
    if (!error && data) return data as OpenHouseRow;
    const code = (error as { code?: string } | null)?.code;
    // 23505 = unique constraint violation. Retry with a new slug.
    if (code !== "23505") {
      throw new Error(error?.message ?? "Failed to create open house");
    }
  }
  throw new Error("Could not generate a unique sign-in slug after 3 attempts");
}

// ── READ ──────────────────────────────────────────────────────────────

export async function listOpenHousesForAgent(
  agentId: string,
): Promise<OpenHouseListItem[]> {
  const { data, error } = await supabaseAdmin
    .from("open_houses")
    .select("*")
    .eq("agent_id", agentId)
    .order("start_at", { ascending: false });
  if (error) throw new Error(error.message);
  const houses = (data ?? []) as OpenHouseRow[];
  if (!houses.length) return [];

  const ids = houses.map((h) => h.id);
  const { data: visitorRows } = await supabaseAdmin
    .from("open_house_visitors")
    .select("open_house_id, timeline, marketing_consent")
    .in("open_house_id", ids);

  const stats = new Map<
    string,
    { total: number; consent: number; hot: number }
  >();
  for (const v of (visitorRows ?? []) as Array<{
    open_house_id: string;
    timeline: string | null;
    marketing_consent: boolean;
  }>) {
    const row = stats.get(v.open_house_id) ?? { total: 0, consent: 0, hot: 0 };
    row.total += 1;
    if (v.marketing_consent) row.consent += 1;
    if (v.timeline === "now") row.hot += 1;
    stats.set(v.open_house_id, row);
  }

  return houses.map((h) => {
    const s = stats.get(h.id) ?? { total: 0, consent: 0, hot: 0 };
    return {
      ...h,
      visitor_total: s.total,
      visitor_with_consent: s.consent,
      visitor_hot: s.hot,
    };
  });
}

export async function getOpenHouseWithVisitors(
  agentId: string,
  id: string,
): Promise<{ openHouse: OpenHouseRow; visitors: OpenHouseVisitorRow[] } | null> {
  const { data: oh, error } = await supabaseAdmin
    .from("open_houses")
    .select("*")
    .eq("id", id)
    .eq("agent_id", agentId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!oh) return null;

  const { data: visitors } = await supabaseAdmin
    .from("open_house_visitors")
    .select("*")
    .eq("open_house_id", id)
    .order("created_at", { ascending: false });

  return {
    openHouse: oh as OpenHouseRow,
    visitors: (visitors ?? []) as OpenHouseVisitorRow[],
  };
}

// ── UPDATE ────────────────────────────────────────────────────────────

export type UpdateOpenHouseInput = Partial<{
  property_address: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  mls_number: string | null;
  mls_url: string | null;
  list_price: number | null;
  start_at: string;
  end_at: string;
  host_notes: string | null;
  status: OpenHouseStatus;
  transaction_id: string | null;
}>;

export async function updateOpenHouse(
  agentId: string,
  id: string,
  input: UpdateOpenHouseInput,
): Promise<OpenHouseRow | null> {
  const patch = { ...input, updated_at: new Date().toISOString() };
  const { data, error } = await supabaseAdmin
    .from("open_houses")
    .update(patch)
    .eq("id", id)
    .eq("agent_id", agentId)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as OpenHouseRow | null) ?? null;
}

export async function deleteOpenHouse(agentId: string, id: string): Promise<boolean> {
  const { error, count } = await supabaseAdmin
    .from("open_houses")
    .delete({ count: "exact" })
    .eq("id", id)
    .eq("agent_id", agentId);
  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}
