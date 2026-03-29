import Papa from "papaparse";
import { supabaseServer } from "@/lib/supabaseServer";
import { upsertPropertyWarehouse, getPropertyByAddress, getLatestSnapshot } from "@/lib/propertyService";
import { savePropertyToCache } from "@/lib/propertyCache";
import { notifyLeadsForPropertyEvent } from "@/lib/smartLeadNotifications";

type CsvRow = Record<string, string>;

export type ImportResult = {
  insertedProperties: number;
  updatedProperties: number;
  insertedSnapshots: number;
  skippedSnapshots: number;
  skippedRows: number;
  errors: Array<{ row: number; error: string }>;
};

type ParsedRow = {
  rawKey: string;
  addressLine1: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  soldPrice: number | null;
  saleDate: string | null; // YYYY-MM-DD
  listingDate: string | null; // YYYY-MM-DD
  propertyType: string | null;
};

type GeocodeResult = {
  formattedAddress: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  lat: number | null;
  lng: number | null;
};

function normalizeSpaces(input: string) {
  return input.trim().replace(/\s+/g, " ");
}

function normalizeAddressForKey(address: string) {
  // Match the normalization style used by our warehouse + cache:
  // - trim
  // - collapse whitespace
  // - lowercase
  return normalizeSpaces(address).replace(/\s+/g, " ").toLowerCase();
}

function normalizeHeaderKey(key: string) {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function getField(row: CsvRow, candidates: string[]): string | null {
  const byNormalized: Record<string, string> = {};
  for (const [k, v] of Object.entries(row)) byNormalized[normalizeHeaderKey(k)] = v;
  for (const c of candidates) {
    const k = normalizeHeaderKey(c);
    if (k in byNormalized) {
      const val = byNormalized[k];
      if (val == null) return null;
      const trimmed = String(val).trim();
      return trimmed ? trimmed : null;
    }
  }
  return null;
}

function parseIntOrNull(v: string | null) {
  if (!v) return null;
  const cleaned = v.replace(/[^\d-]/g, "");
  if (!cleaned) return null;
  const n = parseInt(cleaned, 10);
  return Number.isFinite(n) ? n : null;
}

function parseFloatOrNull(v: string | null) {
  if (!v) return null;
  const cleaned = v.replace(/[^0-9.\-]/g, "");
  if (!cleaned) return null;
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

function parseDateToYmd(v: string | null): string | null {
  if (!v) return null;
  const trimmed = v.trim();
  if (!trimmed) return null;

  // If already in YYYY-MM-DD
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  // If in MM/DD/YYYY (common MLS exports)
  const usMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (usMatch) {
    const mm = usMatch[1].padStart(2, "0");
    const dd = usMatch[2].padStart(2, "0");
    const yyyy = usMatch[3];
    return `${yyyy}-${mm}-${dd}`;
  }

  // Fallback: attempt JS parsing
  const d = new Date(trimmed);
  if (!Number.isFinite(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

async function geocodeAddress(addressQuery: string): Promise<GeocodeResult | null> {
  const apiKey =
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
    "";
  if (!apiKey) return null;
  if (!addressQuery.trim()) return null;

  const res = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
      addressQuery
    )}&key=${apiKey}`
  );
  if (!res.ok) return null;
  const json = (await res.json()) as any;

  if (json?.status !== "OK" || !Array.isArray(json?.results) || !json.results[0]) {
    return null;
  }

  const r0 = json.results[0];
  const formattedAddress: string = String(r0.formatted_address ?? "").trim();
  const location = r0?.geometry?.location;
  const lat = location?.lat ?? null;
  const lng = location?.lng ?? null;

  const comps: Array<any> = Array.isArray(r0.address_components)
    ? r0.address_components
    : [];

  const getComp = (types: string[]) => {
    const hit = comps.find((c) => types.some((t) => c.types?.includes(t)));
    return hit?.long_name ? String(hit.long_name) : null;
  };

  const zip = getComp(["postal_code"]);
  const state = getComp(["administrative_area_level_1"]);
  const city =
    getComp(["locality"]) ??
    getComp(["sublocality"]) ??
    getComp(["administrative_area_level_2"]);

  return {
    formattedAddress,
    city,
    state,
    zip,
    lat: typeof lat === "number" ? lat : null,
    lng: typeof lng === "number" ? lng : null,
  };
}

async function detectWarehouseWriteTables(): Promise<{
  properties: "properties" | "properties_dw";
  snapshots: "property_snapshots" | "property_snapshots_dw";
}> {
  async function tableExists(table: string) {
    const { error } = await supabaseServer.from(table).select("id").limit(1);
    if (!error) return true;
    const msg = String((error as any).message ?? "");
    if (/could not find the table/i.test(msg) || /does not exist/i.test(msg))
      return false;
    return true;
  }

  const hasDw = await tableExists("properties_dw");
  const hasSnapshotsDw = await tableExists("property_snapshots_dw");

  return {
    properties: hasDw ? "properties_dw" : "properties",
    snapshots: hasSnapshotsDw ? "property_snapshots_dw" : "property_snapshots",
  };
}

export async function importMlsCsv(csvText: string): Promise<ImportResult> {
  const result: ImportResult = {
    insertedProperties: 0,
    updatedProperties: 0,
    insertedSnapshots: 0,
    skippedSnapshots: 0,
    skippedRows: 0,
    errors: [],
  };

  // 1) Parse CSV with header row
  const parsed = Papa.parse<CsvRow>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  if (parsed.errors?.length) {
    // Continue; we may still parse usable rows.
    console.error("MLS CSV parse errors:", parsed.errors.slice(0, 5));
  }

  const rows = (parsed.data ?? []) as CsvRow[];
  if (!rows.length) return result;

  // 2) Normalize + basic parsing, then dedupe by normalized address key
  const byKey = new Map<string, { rowIndex: number; row: ParsedRow }>();

  rows.forEach((row, i) => {
    const addressLine1 =
      getField(row, ["Address", "Address Line 1", "Street Address", "Street"]) ?? "";
    const city = getField(row, ["City"]);
    const state = getField(row, ["State", "Province"]);
    const zip = getField(row, ["Zip", "ZIP", "Zip Code", "Postal Code"]);

    if (!addressLine1.trim()) {
      result.skippedRows++;
      return;
    }

    const beds = parseIntOrNull(getField(row, ["Beds", "Bed", "Bedrooms", "Bedrooms (Total)"]));
    const baths = parseFloatOrNull(getField(row, ["Baths", "Bath", "Bathrooms", "Full Baths", "Total Baths"]));
    const sqft = parseIntOrNull(getField(row, ["Square Feet", "Sqft", "Sq Ft", "Living Area"]));

    const soldPrice = parseFloatOrNull(
      getField(row, ["Sold Price", "SoldPrice", "Sale Price", "Sold Price (Total)"])
    );

    const saleDate = parseDateToYmd(getField(row, ["Sale Date", "Sold Date", "SaleDate", "Close Date"]));
    const listingDate = parseDateToYmd(getField(row, ["Listing Date", "List Date", "ListingDate"]));

    const propertyType = getField(row, ["Property Type", "Type", "PropertyType"]);

    // Normalize key for deduping (before geocoding).
    const rawKey = normalizeAddressForKey(
      [addressLine1, city, state, zip].filter(Boolean).join(", ")
    );

    const pr: ParsedRow = {
      rawKey,
      addressLine1: normalizeSpaces(addressLine1),
      city,
      state,
      zip,
      beds,
      baths,
      sqft,
      soldPrice: Number.isFinite(soldPrice as any) ? soldPrice : null,
      saleDate,
      listingDate,
      propertyType,
    };

    const existing = byKey.get(rawKey);
    if (!existing) {
      byKey.set(rawKey, { rowIndex: i, row: pr });
      return;
    }

    const toScore = (r: ParsedRow) => {
      const t = r.saleDate ? new Date(`${r.saleDate}T00:00:00.000Z`).getTime() : null;
      if (t != null && Number.isFinite(t)) return t;
      return r.listingDate
        ? new Date(`${r.listingDate}T00:00:00.000Z`).getTime()
        : 0;
    };

    const curScore = toScore(pr);
    const prevScore = toScore(existing.row);
    const curPrefersSold = pr.soldPrice != null && existing.row.soldPrice == null;

    if (curScore > prevScore || curPrefersSold) {
      byKey.set(rawKey, { rowIndex: i, row: pr });
    }
  });

  const uniqueRows = Array.from(byKey.entries()).map(([, v]) => v);

  // 3) Detect warehouse write table names for snapshots
  const tables = await detectWarehouseWriteTables();

  // 4) Geocode cache + insert into DB
  const geocodeCache = new Map<string, GeocodeResult | null>();

  for (const { rowIndex, row } of uniqueRows) {
    try {
      const query = [row.addressLine1, row.city, row.state, row.zip]
        .filter(Boolean)
        .join(", ");

      let geo = geocodeCache.get(query);
      if (!geocodeCache.has(query)) {
        geo = await geocodeAddress(query);
        geocodeCache.set(query, geo);
      }

      // Use Google formatted address when available to maximize match consistency.
      const addressForDb = geo?.formattedAddress
        ? geo.formattedAddress
        : [row.addressLine1, row.city, row.state, row.zip].filter(Boolean).join(", ");

      const city = geo?.city ?? row.city ?? null;
      const state = geo?.state ?? row.state ?? null;
      const zip_code = geo?.zip ?? row.zip ?? null;
      const lat = geo?.lat ?? null;
      const lng = geo?.lng ?? null;

      // Skip completely invalid address after geocoding fallback.
      if (!addressForDb.trim()) {
        result.skippedRows++;
        continue;
      }

      // Check if property exists (to count inserted vs updated).
      const existing = await getPropertyByAddress(addressForDb);

      const propertyRow = await upsertPropertyWarehouse({
        address: addressForDb,
        city,
        state,
        zip_code,
        beds: row.beds,
        baths: row.baths,
        sqft: row.sqft,
        property_type: row.propertyType,
        lat,
        lng,
      });

      if (existing?.id) result.updatedProperties++;
      else result.insertedProperties++;

      // Update fast cache so address-based lookups don’t fall back to mock data.
      await savePropertyToCache(addressForDb, {
        address: addressForDb,
        city,
        state,
        zip: zip_code,
        zip_code,
        beds: row.beds,
        baths: row.baths,
        sqft: row.sqft,
        price: row.soldPrice,
        rent_estimate: null,
        lat,
        lng,
        property_type: row.propertyType,
      }, { city, state, zip_code });

      // 5) Insert sold snapshots (history for comps/estimation)
      if (row.soldPrice != null && row.saleDate) {
        const createdAtIso = new Date(`${row.saleDate}T00:00:00.000Z`).toISOString();
        const ppsf =
          row.sqft && row.sqft > 0 ? row.soldPrice / row.sqft : null;

        // Idempotency: check if snapshot with same property_id + estimated_value + created_at exists.
        const { data: existingSnap } = await supabaseServer
          .from(tables.snapshots)
          .select("id")
          .eq("property_id", propertyRow.id)
          .eq("estimated_value", row.soldPrice)
          .eq("listing_status", "sold")
          .eq("created_at", createdAtIso)
          .maybeSingle();

        if (existingSnap?.id) {
          result.skippedSnapshots++;
        } else {
          const { error: snapErr } = await supabaseServer
            .from(tables.snapshots)
            .insert({
              property_id: propertyRow.id,
              estimated_value: row.soldPrice,
              rent_estimate: null,
              price_per_sqft: ppsf,
              listing_status: "sold",
              created_at: createdAtIso,
              data: {
                sale_date: row.saleDate,
                listing_date: row.listingDate,
                source: "mls_csv",
              },
            });

          if (snapErr) throw snapErr;
          result.insertedSnapshots++;

          // Notify leads about a nearby sold property (best-effort).
          try {
            await notifyLeadsForPropertyEvent({
              propertyId: propertyRow.id,
              propertyAddress: addressForDb,
              lat: propertyRow.lat,
              lng: propertyRow.lng,
              beds: propertyRow.beds,
              baths: propertyRow.baths,
              price: row.soldPrice,
              eventType: "sold",
            });
          } catch (e) {
            console.error("mlsImport: notify sold failed", e);
          }
        }
      }

      // Notify leads about a new nearby listing (best-effort).
      // MLS exports may not include list price; we use soldPrice when available (otherwise price matching is skipped).
      if (row.listingDate) {
        try {
          const latestSnap = await getLatestSnapshot(propertyRow.id);
          const priceForMatch = row.soldPrice ?? latestSnap?.estimated_value ?? null;

          await notifyLeadsForPropertyEvent({
            propertyId: propertyRow.id,
            propertyAddress: addressForDb,
            lat: propertyRow.lat,
            lng: propertyRow.lng,
            beds: propertyRow.beds,
            baths: propertyRow.baths,
            price: priceForMatch,
            eventType: "new_listing",
          });
        } catch (e) {
          console.error("mlsImport: notify new_listing failed", e);
        }
      }
    } catch (e: any) {
      result.errors.push({
        row: rowIndex,
        error: e?.message ?? "Unknown error",
      });
    }
  }

  return result;
}

