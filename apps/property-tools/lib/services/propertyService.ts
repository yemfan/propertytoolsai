import { supabaseServer } from "@/lib/supabaseServer";
import { getPropertyData } from "@/lib/getPropertyData";

export type PropertyCore = {
  address: string;
  city: string;
  state: string;
  zip: string;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  price: number | null;
  rent: number | null;
};

export type PropertyCacheRow = PropertyCore & {
  id: number;
  last_updated: string;
};

export type PropertyReportInput = {
  property_id: number;
  source: "home_value" | "rental" | "deal" | "cma";
  estimated_value?: number | null;
  rent_estimate?: number | null;
  cash_flow?: number | null;
  cap_rate?: number | null;
  roi?: number | null;
  deal_score?: number | null;
  metrics_json?: any;
};

const CACHE_TTL_DAYS = 7;

function isFresh(lastUpdated: string) {
  const ageMs = Date.now() - new Date(lastUpdated).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  return ageDays < CACHE_TTL_DAYS;
}

export async function getCachedProperty(
  address: string
): Promise<PropertyCacheRow | null> {
  const { data, error } = await supabaseServer
    .from("property_cache")
    .select(
      "id,address,city,state,zip,beds,baths,sqft,price,rent_estimate as rent,last_updated"
    )
    .ilike("address", address.trim())
    .order("last_updated", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error && (error as any).code !== "PGRST116") {
    throw error;
  }
  if (!data || !isFresh((data as any).last_updated)) return null;
  // Supabase type inference can be too narrow (e.g. when parsing JSON/union results).
  // Use `unknown` as the bridge to keep TS strict while preserving runtime behavior.
  return data as unknown as PropertyCacheRow;
}

export async function saveToCache(
  property: PropertyCore
): Promise<PropertyCacheRow> {
  const { data, error } = await supabaseServer
    .from("property_cache")
    .upsert(
      {
        address: property.address,
        city: property.city,
        state: property.state,
        zip: property.zip,
        beds: property.beds,
        baths: property.baths,
        sqft: property.sqft,
        price: property.price,
        rent_estimate: property.rent,
        last_updated: new Date().toISOString(),
      },
      { onConflict: "address" }
    )
    .select(
      "id,address,city,state,zip,beds,baths,sqft,price,rent_estimate as rent,last_updated"
    )
    .single();

  if (error) throw error;
  return data as unknown as PropertyCacheRow;
}

export async function upsertProperty(
  property: PropertyCore
): Promise<{ id: number }> {
  const { data, error } = await supabaseServer
    .from("properties")
    .upsert(
      {
        address_line1: property.address,
        city: property.city,
        state: property.state,
        zip: property.zip,
        beds: property.beds,
        baths: property.baths,
        sqft: property.sqft,
        year_built: null,
        lot_size_sqft: null,
      },
      { onConflict: "address_line1,city,zip" }
    )
    .select("id")
    .single();

  if (error) throw error;
  return { id: (data as any).id };
}

export async function createPropertyReport(input: PropertyReportInput) {
  const { error } = await supabaseServer.from("property_reports").insert({
    property_id: input.property_id,
    estimated_value: input.estimated_value ?? null,
    rent_estimate: input.rent_estimate ?? null,
    cash_flow: input.cash_flow ?? null,
    cap_rate: input.cap_rate ?? null,
    roi: input.roi ?? null,
    deal_score: input.deal_score ?? null,
    source: input.source,
    metrics_json: input.metrics_json ?? null,
  });

  if (error) throw error;
}

export async function resolveProperty(
  address: string,
  forceRefresh = false
): Promise<{ property: PropertyCore; property_id: number }> {
  const propertyData = (await getPropertyData(address, forceRefresh)) as any;

  if (!propertyData || typeof propertyData !== "object") {
    throw new Error("Failed to fetch property data");
  }

  const property: PropertyCore = {
    address: String(propertyData.address ?? address).trim(),
    city: String(propertyData.city ?? ""),
    state: String(propertyData.state ?? ""),
    zip: String(propertyData.zip ?? propertyData.zip_code ?? ""),
    beds: propertyData.beds ?? null,
    baths: propertyData.baths ?? null,
    sqft: propertyData.sqft ?? null,
    price: propertyData.price ?? null,
    rent: propertyData.rent ?? propertyData.rent_estimate ?? null,
  };

  const { id: property_id } = await upsertProperty(property);

  return { property, property_id };
}

