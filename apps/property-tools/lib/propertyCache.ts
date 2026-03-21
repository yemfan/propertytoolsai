import { supabaseServer } from "@/lib/supabaseServer";
import { CACHE_DURATION_MS } from "@/lib/cacheConfig";

export type PropertiesCacheRow = {
  id: string;
  address: string;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  data: unknown;
  last_updated: string;
  created_at: string;
};

function normalizeAddress(address: string): string {
  return address.trim().replace(/\s+/g, " ").toLowerCase();
}

export async function getCachedProperty(
  address: string
): Promise<PropertiesCacheRow | null> {
  const normalizedAddress = normalizeAddress(address);

  const { data, error } = await supabaseServer
    .from("properties_cache")
    .select(
      "id,address,city,state,zip_code,data,last_updated,created_at"
    )
    .eq("address", normalizedAddress)
    .maybeSingle();

  if (error && (error as any).code !== "PGRST116") {
    throw error;
  }

  return (data as PropertiesCacheRow) ?? null;
}

export function isCacheExpired(property: PropertiesCacheRow | null): boolean {
  if (!property) return true;
  const lastUpdated = new Date(property.last_updated).getTime();
  return Date.now() - lastUpdated > CACHE_DURATION_MS;
}

export async function savePropertyToCache(
  address: string,
  propertyData: unknown,
  partial?: { city?: string | null; state?: string | null; zip_code?: string | null }
): Promise<void> {
  const normalizedAddress = normalizeAddress(address);

  const { error } = await supabaseServer.from("properties_cache").upsert(
    {
      address: normalizedAddress,
      city: partial?.city ?? null,
      state: partial?.state ?? null,
      zip_code: partial?.zip_code ?? null,
      data: propertyData,
      last_updated: new Date().toISOString(),
    },
    { onConflict: "address" }
  );

  if (error) throw error;
}

