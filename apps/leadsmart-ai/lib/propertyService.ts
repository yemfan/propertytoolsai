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

export async function getComparables(address: string, limit = 10) {
  const subject = await getPropertyByAddress(address);
  if (!subject) {
    return { subject: null, comps: [] as PropertyCompRow[] };
  }

  // Simple v1: same ZIP, exclude self, similar beds/baths/sqft.
  const { data: candidateProps, error } = await supabaseServer
    .from("properties_warehouse")
    .select("*")
    .eq("zip_code", subject.zip_code)
    .neq("id", subject.id)
    .limit(100);

  if (error) throw error;

  const candidates = ((candidateProps as PropertyRow[]) ?? []).map((p) => ({
    property: p,
    score: similarityScore(subject, p),
  }));

  const top = candidates
    .filter((c) => c.score >= 0.25)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  // Persist comps (idempotent) with similarity score and sold info (from latest snapshots).
  // This makes imported MLS sold history immediately usable by estimators/CMAs.
  const compsWithSold = await Promise.all(
    top.map(async (c) => {
      const snap = await getLatestSnapshot(c.property.id);
      const listingStatus = snap?.listing_status ?? null;
      const estimated = snap?.estimated_value ?? null;
      const data = (snap?.data ?? {}) as any;

      const soldPrice =
        listingStatus === "sold" && estimated != null ? Number(estimated) : null;

      // Import stores `sale_date` inside snapshot.data.
      const saleDateRaw =
        typeof data?.sale_date === "string"
          ? data.sale_date
          : typeof data?.saleDate === "string"
            ? data.saleDate
            : null;

      const soldDate = saleDateRaw ? String(saleDateRaw) : null;

      return {
        property: c.property,
        score: c.score,
        sold_price: soldPrice,
        sold_date: soldDate,
      };
    })
  );

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

