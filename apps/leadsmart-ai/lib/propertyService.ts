import { supabaseServer } from "@/lib/supabaseServer";
import { notifyLeadsForPropertyEvent } from "@/lib/smartLeadNotifications";

export type PropertyRow = {
  id: string;
  address: string;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  lat: number | null;
  lng: number | null;
  property_type: string | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  lot_size: number | null;
  year_built: number | null;
  created_at: string;
  updated_at: string;
};

export type PropertySnapshotRow = {
  id: string;
  property_id: string;
  estimated_value: number | null;
  rent_estimate: number | null;
  price_per_sqft: number | null;
  listing_status: string | null;
  data: unknown;
  created_at: string;
};

export type PropertyCompRow = {
  id: string;
  subject_property_id: string;
  comp_property_id: string;
  distance_miles: number | null;
  sold_price: number | null;
  sold_date: string | null;
  similarity_score: number | null;
  created_at: string;
  comp_property?: PropertyRow;
};

function normalizeAddress(address: string): string {
  return address.trim().replace(/\s+/g, " ").toLowerCase();
}

let cachedWriteTables:
  | {
      properties: "properties" | "properties_dw";
      snapshots: "property_snapshots" | "property_snapshots_dw";
      comps: "property_comps" | "property_comps_dw";
    }
  | null = null;

async function detectWarehouseWriteTables(): Promise<NonNullable<typeof cachedWriteTables>> {
  if (cachedWriteTables) return cachedWriteTables;

  async function tableExists(table: string) {
    const { error } = await supabaseServer.from(table).select("id").limit(1);
    if (!error) return true;
    const msg = String((error as any).message ?? "");
    // PostgREST returns missing table as a message containing "Could not find the table"
    if (/could not find the table/i.test(msg) || /does not exist/i.test(msg)) return false;
    // If it's some other error (e.g., RLS), assume it exists.
    return true;
  }

  const hasDw = await tableExists("properties_dw");
  const hasSnapshotsDw = await tableExists("property_snapshots_dw");
  const hasCompsDw = await tableExists("property_comps_dw");

  cachedWriteTables = {
    properties: hasDw ? "properties_dw" : "properties",
    snapshots: hasSnapshotsDw ? "property_snapshots_dw" : "property_snapshots",
    comps: hasCompsDw ? "property_comps_dw" : "property_comps",
  };
  return cachedWriteTables;
}

export async function getPropertyByAddress(
  address: string
): Promise<PropertyRow | null> {
  const normalized = normalizeAddress(address);
  const { data, error } = await supabaseServer
    .from("properties_warehouse")
    .select("*")
    .eq("address", normalized)
    .maybeSingle();

  if (error && (error as any).code !== "PGRST116") throw error;
  return (data as PropertyRow) ?? null;
}

export async function getPropertyHistory(
  propertyId: string,
  limit = 52
): Promise<PropertySnapshotRow[]> {
  const { data, error } = await supabaseServer
    .from("property_snapshots_warehouse")
    .select(
      "id,property_id,estimated_value,rent_estimate,price_per_sqft,listing_status,data,created_at"
    )
    .eq("property_id", propertyId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data as PropertySnapshotRow[]) ?? [];
}

export async function getLatestSnapshot(
  propertyId: string
): Promise<PropertySnapshotRow | null> {
  const { data, error } = await supabaseServer
    .from("property_snapshots_warehouse")
    .select(
      "id,property_id,estimated_value,rent_estimate,price_per_sqft,listing_status,data,created_at"
    )
    .eq("property_id", propertyId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error && (error as any).code !== "PGRST116") throw error;
  return (data as PropertySnapshotRow) ?? null;
}

export async function upsertPropertyWarehouse(
  input: Partial<PropertyRow> & { address: string }
): Promise<PropertyRow> {
  const tables = await detectWarehouseWriteTables();

  const address = normalizeAddress(input.address);

  const rowFull = {
    address,
    city: input.city ?? null,
    state: input.state ?? null,
    zip_code: input.zip_code ?? null,
    lat: input.lat ?? null,
    lng: input.lng ?? null,
    property_type: input.property_type ?? null,
    beds: input.beds ?? null,
    baths: input.baths ?? null,
    sqft: input.sqft ?? null,
    lot_size: input.lot_size ?? null,
    year_built: input.year_built ?? null,
  };

  const rowMinimal = {
    address,
    city: input.city ?? null,
    state: input.state ?? null,
    zip_code: input.zip_code ?? null,
    beds: input.beds ?? null,
    baths: input.baths ?? null,
    sqft: input.sqft ?? null,
  };

  const row = tables.properties === "properties_dw" ? rowFull : rowMinimal;

  const { data, error } = await supabaseServer
    .from(tables.properties)
    .upsert(row, { onConflict: "address" })
    .select("*")
    .single();

  if (error) throw error;
  return data as PropertyRow;
}

function withinLastDays(iso: string, days: number): boolean {
  const ageMs = Date.now() - new Date(iso).getTime();
  return ageMs < days * 24 * 60 * 60 * 1000;
}

function pctChange(a: number, b: number): number {
  if (!isFinite(a) || !isFinite(b) || a === 0) return Infinity;
  return Math.abs((b - a) / a);
}

export async function insertSnapshotIfNeeded(params: {
  propertyId: string;
  estimatedValue?: number | null;
  rentEstimate?: number | null;
  pricePerSqft?: number | null;
  listingStatus?: string | null;
  data?: unknown;
}): Promise<{ inserted: boolean; snapshot: PropertySnapshotRow | null }> {
  const latest = await getLatestSnapshot(params.propertyId);

  const newValue = params.estimatedValue ?? null;
  const latestValue = latest?.estimated_value ?? null;

  const shouldInsert =
    !latest ||
    !withinLastDays(latest.created_at, 7) ||
    (latestValue != null &&
      newValue != null &&
      pctChange(Number(latestValue), Number(newValue)) > 0.02);

  if (!shouldInsert) {
    return { inserted: false, snapshot: latest };
  }

  const tables = await detectWarehouseWriteTables();

  const { data, error } = await supabaseServer
    .from(tables.snapshots)
    .insert({
      property_id: params.propertyId,
      estimated_value: params.estimatedValue ?? null,
      rent_estimate: params.rentEstimate ?? null,
      price_per_sqft: params.pricePerSqft ?? null,
      listing_status: params.listingStatus ?? null,
      data: params.data ?? null,
    })
    .select(
      "id,property_id,estimated_value,rent_estimate,price_per_sqft,listing_status,data,created_at"
    )
    .single();

  if (error) throw error;
  const insertedSnapshot = data as PropertySnapshotRow;

  // Smart notifications (best-effort): when we insert a new snapshot,
  // treat it as either a sale or a new listing depending on listing_status.
  try {
    const eventType = insertedSnapshot.listing_status === "sold" ? "sold" : "new_listing";
    const { data: propertyRow } = await supabaseServer
      .from("properties_warehouse")
      .select("id,address,lat,lng,beds,baths")
      .eq("id", insertedSnapshot.property_id)
      .maybeSingle();

    if (propertyRow?.id) {
      await notifyLeadsForPropertyEvent({
        propertyId: String(propertyRow.id),
        propertyAddress: String(propertyRow.address ?? ""),
        lat: propertyRow.lat ?? null,
        lng: propertyRow.lng ?? null,
        beds: propertyRow.beds ?? null,
        baths: propertyRow.baths ?? null,
        price: insertedSnapshot.estimated_value ?? null,
        eventType,
      });
    }
  } catch (e) {
    console.error("insertSnapshotIfNeeded: notify failed", e);
  }

  return { inserted: true, snapshot: insertedSnapshot };
}

const COMP_SNAPSHOT_HISTORY_LIMIT = 40;
/** Max warehouse rows to consider in the subject ZIP (similarity-ranked). */
const COMP_CANDIDATE_POOL = 300;
/** Max snapshot-history fetches per request (caps DB load). */
const COMP_MAX_HISTORY_SCANS = 250;
const COMP_HISTORY_FETCH_BATCH = 12;

function coalescePositiveNumber(...vals: unknown[]): number | null {
  for (const v of vals) {
    const n =
      typeof v === "number"
        ? v
        : v != null && String(v).trim() !== ""
          ? Number(v)
          : NaN;
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

function isSoldListingStatus(status: string | null | undefined): boolean {
  const s = String(status ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  return s === "sold" || s === "closed" || s === "off_market_sold";
}

/**
 * Scan recent snapshot history and pick the most recent qualifying sale (status and/or sale date + price).
 */
export function extractCompSaleFromHistory(
  snapshots: PropertySnapshotRow[]
): { soldPrice: number | null; soldDate: string | null } {
  if (!snapshots.length) return { soldPrice: null, soldDate: null };

  let best: { price: number; date: string; timeMs: number } | null = null;

  for (const snap of snapshots) {
    const data = (snap.data && typeof snap.data === "object"
      ? snap.data
      : {}) as Record<string, unknown>;
    const saleDateRaw =
      (typeof data.sale_date === "string" && data.sale_date.trim()) ||
      (typeof data.saleDate === "string" && data.saleDate.trim()) ||
      null;

    const dataPriceFields = [
      data.sold_price,
      data.sale_price,
      data.close_price,
      data.closed_price,
      data.last_sold_price,
    ];

    const statusSold = isSoldListingStatus(snap.listing_status);

    let price: number | null = null;
    if (statusSold) {
      price = coalescePositiveNumber(snap.estimated_value, ...dataPriceFields);
    } else if (saleDateRaw) {
      price = coalescePositiveNumber(...dataPriceFields, data.price, snap.estimated_value);
    }

    if (price == null || price <= 0) continue;

    const dateStr = saleDateRaw || snap.created_at;
    const timeMs = new Date(dateStr).getTime();
    const t = Number.isFinite(timeMs) ? timeMs : 0;
    if (!best || t > best.timeMs) {
      best = { price, date: dateStr, timeMs: t };
    }
  }

  return best ? { soldPrice: best.price, soldDate: best.date } : { soldPrice: null, soldDate: null };
}

function similarityScore(subject: PropertyRow, comp: PropertyRow): number {
  const bedsA = subject.beds ?? 0;
  const bedsB = comp.beds ?? 0;
  const bathsA = subject.baths ?? 0;
  const bathsB = comp.baths ?? 0;
  const sqftA = subject.sqft ?? 0;
  const sqftB = comp.sqft ?? 0;

  const bedsDiff = Math.abs(bedsA - bedsB);
  const bathsDiff = Math.abs(bathsA - bathsB);
  const sqftDiffPct = sqftA > 0 ? Math.abs(sqftA - sqftB) / sqftA : 1;

  // Lower is better; convert to similarity score in [0..1]
  const penalty = bedsDiff * 0.25 + bathsDiff * 0.2 + sqftDiffPct * 0.7;
  return Math.max(0, 1 - penalty);
}

async function loadZipCompCandidateProperties(subject: PropertyRow): Promise<PropertyRow[]> {
  const { data: idArray, error: rpcError } = await supabaseServer.rpc(
    "warehouse_property_ids_in_zip_with_sale_price",
    {
      p_zip: subject.zip_code,
      p_exclude_property_id: subject.id,
      p_max: COMP_CANDIDATE_POOL,
    }
  );

  if (rpcError) throw rpcError;
  if (!Array.isArray(idArray) || idArray.length === 0) return [];

  const { data: rows, error } = await supabaseServer
    .from("properties_warehouse")
    .select("*")
    .in("id", idArray);
  if (error) throw error;
  return (rows as PropertyRow[]) ?? [];
}

export async function getComparables(address: string, limit = 10) {
  const subject = await getPropertyByAddress(address);
  if (!subject) {
    return { subject: null, comps: [] as PropertyCompRow[] };
  }

  const candidateProps = await loadZipCompCandidateProperties(subject);

  const ordered = ((candidateProps as PropertyRow[]) ?? [])
    .map((p) => ({
      property: p,
      score: similarityScore(subject, p),
    }))
    .sort((a, b) => b.score - a.score);

  const priced: Array<{
    property: PropertyRow;
    score: number;
    sold_price: number;
    sold_date: string | null;
  }> = [];

  const scanCap = Math.min(ordered.length, COMP_MAX_HISTORY_SCANS);
  for (let i = 0; i < scanCap && priced.length < limit; i += COMP_HISTORY_FETCH_BATCH) {
    const batch = ordered.slice(i, Math.min(i + COMP_HISTORY_FETCH_BATCH, scanCap));
    const resolved = await Promise.all(
      batch.map(async (c) => {
        const history = await getPropertyHistory(c.property.id, COMP_SNAPSHOT_HISTORY_LIMIT);
        const { soldPrice, soldDate } = extractCompSaleFromHistory(history);
        return { ...c, soldPrice, soldDate };
      })
    );
    for (const row of resolved) {
      const p =
        row.soldPrice != null && Number.isFinite(Number(row.soldPrice))
          ? Number(row.soldPrice)
          : NaN;
      if (!Number.isFinite(p) || p <= 0) continue;
      priced.push({
        property: row.property,
        score: row.score,
        sold_price: p,
        sold_date: row.soldDate,
      });
      if (priced.length >= limit) break;
    }
  }

  const compsWithSold = priced;

  const upserts = compsWithSold.map((c) => ({
    subject_property_id: subject.id,
    comp_property_id: c.property.id,
    similarity_score: c.score,
    distance_miles: null,
    sold_price: c.sold_price,
    sold_date: c.sold_date,
  }));

  if (upserts.length) {
    const tables = await detectWarehouseWriteTables();
    const { error: upsertErr } = await supabaseServer
      .from(tables.comps)
      .upsert(upserts, { onConflict: "subject_property_id,comp_property_id" });
    if (upsertErr) throw upsertErr;
  }

  const comps: PropertyCompRow[] = compsWithSold.map((c) => ({
    id: "",
    subject_property_id: subject.id,
    comp_property_id: c.property.id,
    similarity_score: c.score,
    distance_miles: null,
    sold_price: c.sold_price,
    sold_date: c.sold_date,
    created_at: new Date().toISOString(),
    comp_property: c.property,
  }));

  return { subject, comps };
}

