/**
 * Persist home value funnel rows (Supabase). Failures are logged; callers should not throw.
 */
import { supabaseServer } from "@/lib/supabaseServer";
import type {
  ConfidenceOutput,
  HomeValueEstimateOutput,
  NormalizedProperty,
} from "@/lib/homeValue/types";

export type PersistEstimateInput = {
  sessionId: string;
  userId: string | null;
  addressRaw: string;
  merged: NormalizedProperty;
  condition: string;
  renovation: string;
  estimate: HomeValueEstimateOutput;
  confidence: ConfidenceOutput;
  likelyIntent: string;
};

function nonEmptyCityStateZip(merged: NormalizedProperty) {
  const city = (merged.city ?? "").trim() || "Unknown";
  const state = (merged.state ?? "").trim() || "—";
  const zip = (merged.zip ?? "").trim() || "00000";
  return { city, state, zip };
}

export async function upsertHomeValueSession(input: PersistEstimateInput): Promise<void> {
  const { city, state, zip } = nonEmptyCityStateZip(input.merged);
  const r = input.renovation;
  const renovated_recently =
    r === "none"
      ? false
      : r === "cosmetic" || r === "major" || r === "full"
        ? true
        : null;

  const row = {
    session_id: input.sessionId,
    user_id: input.userId,
    full_address: input.addressRaw.trim(),
    street: null as string | null,
    city,
    state,
    zip,
    lat: input.merged.lat != null ? Number(input.merged.lat) : null,
    lng: input.merged.lng != null ? Number(input.merged.lng) : null,
    property_type: input.merged.propertyType,
    beds: input.merged.beds != null ? Number(input.merged.beds) : null,
    baths: input.merged.baths != null ? Number(input.merged.baths) : null,
    sqft: input.merged.sqft != null ? Math.round(Number(input.merged.sqft)) : null,
    year_built: input.merged.yearBuilt != null ? Math.round(Number(input.merged.yearBuilt)) : null,
    lot_size: input.merged.lotSqft != null ? Math.round(Number(input.merged.lotSqft)) : null,
    condition: input.condition,
    renovated_recently,
    estimate_value: input.estimate.point,
    estimate_low: input.estimate.low,
    estimate_high: input.estimate.high,
    confidence: input.confidence.level,
    confidence_score: Math.round(input.confidence.score),
    likely_intent: input.likelyIntent,
    source: "propertytoolsai_home_value",
  };

  const { error } = await supabaseServer.from("home_value_sessions").upsert(row, {
    onConflict: "session_id",
  });

  if (error) {
    console.warn("[funnelPersistence] upsert home_value_sessions", error.message);
  }
}

export async function insertToolEvent(input: {
  sessionId: string;
  userId: string | null;
  toolName: string;
  eventName: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const { error } = await supabaseServer.from("tool_events").insert({
    session_id: input.sessionId,
    user_id: input.userId,
    tool_name: input.toolName,
    event_name: input.eventName,
    metadata: input.metadata ?? null,
  });
  if (error) {
    console.warn("[funnelPersistence] insert tool_events", error.message);
  }
}

/** Cache one market row per city+zip+day when we have usable numbers. */
export async function maybeInsertMarketSnapshot(input: {
  city: string;
  zip: string | null;
  propertyType: string | null;
  medianPpsf: number;
  medianPrice: number | null;
  yoyTrendPct: number | null;
  avgDaysOnMarket: number | null;
  compCount: number | null;
}): Promise<void> {
  const city = input.city.trim();
  if (!city) return;

  const snapshotDate = new Date().toISOString().slice(0, 10);

  let sel = supabaseServer
    .from("market_snapshots")
    .select("id")
    .eq("city", city)
    .eq("snapshot_date", snapshotDate)
    .limit(1);
  sel = input.zip != null && input.zip !== "" ? sel.eq("zip", input.zip) : sel.is("zip", null);

  const { data: existingRows, error: selErr } = await sel;

  if (selErr) {
    console.warn("[funnelPersistence] market_snapshots select", selErr.message);
    return;
  }
  if (existingRows && existingRows.length > 0) return;

  const { error } = await supabaseServer.from("market_snapshots").insert({
    city,
    zip: input.zip,
    property_type: input.propertyType,
    median_ppsf: input.medianPpsf,
    median_price: input.medianPrice,
    yoy_trend_pct: input.yoyTrendPct,
    avg_days_on_market: input.avgDaysOnMarket,
    comp_count: input.compCount,
    snapshot_date: snapshotDate,
  });

  if (error) {
    console.warn("[funnelPersistence] insert market_snapshots", error.message);
  }
}
