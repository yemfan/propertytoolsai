import type { ListingResult, ListingSearchInput, ListingsAdapter } from "./types";

function mapPropertyType(value?: string): string | undefined {
  if (!value) return undefined;
  const normalized = value.toLowerCase();
  if (normalized.includes("single")) return "single_family";
  if (normalized.includes("condo")) return "condo";
  if (normalized.includes("town")) return "townhome";
  if (normalized.includes("multi") || normalized.includes("duplex")) return "multi_family";
  return normalized.replaceAll(" ", "_");
}

function normalizePhotos(row: Record<string, unknown>): string[] {
  const photosRaw = row?.photos;
  if (Array.isArray(photosRaw) && photosRaw.length) {
    return photosRaw
      .map((photo: unknown) => {
        if (typeof photo === "string") return photo;
        if (photo && typeof photo === "object") {
          const p = photo as Record<string, unknown>;
          return (p.href ?? p.url ?? p.link ?? null) as string | null;
        }
        return null;
      })
      .filter((x): x is string => Boolean(x));
  }

  const imagesRaw = row?.images;
  if (Array.isArray(imagesRaw) && imagesRaw.length) {
    return imagesRaw
      .map((img: unknown) => {
        if (img && typeof img === "object") {
          const i = img as Record<string, unknown>;
          return (i.href ?? i.url ?? null) as string | null;
        }
        return null;
      })
      .filter((x): x is string => Boolean(x));
  }

  return [];
}

function normalizeListing(row: Record<string, unknown>): ListingResult {
  const photos = normalizePhotos(row);

  return {
    id: String(row?.id ?? row?.listingId ?? row?.propertyId ?? ""),
    address: (row?.formattedAddress ?? row?.addressLine1 ?? "Unknown address") as string,
    city: (row?.city ?? "") as string,
    state: (row?.state ?? "") as string,
    zip: (row?.zipCode ?? row?.zip ?? "") as string,
    lat: typeof row?.latitude === "number" ? row.latitude : undefined,
    lng: typeof row?.longitude === "number" ? row.longitude : undefined,
    price: Number(row?.price ?? 0),
    beds: typeof row?.bedrooms === "number" ? row.bedrooms : undefined,
    baths: typeof row?.bathrooms === "number" ? row.bathrooms : undefined,
    sqft: typeof row?.squareFootage === "number" ? row.squareFootage : undefined,
    lotSize: typeof row?.lotSize === "number" ? row.lotSize : undefined,
    yearBuilt: typeof row?.yearBuilt === "number" ? row.yearBuilt : undefined,
    propertyType: mapPropertyType(row?.propertyType as string | undefined),
    status: (row?.status as string | undefined) || undefined,
    daysOnMarket: typeof row?.daysOnMarket === "number" ? row.daysOnMarket : undefined,
    listingAgentName:
      (row?.listingAgent as Record<string, unknown> | undefined)?.name?.toString() ||
      (row?.agentName as string | undefined),
    listingAgentPhone:
      (row?.listingAgent as Record<string, unknown> | undefined)?.phone?.toString() ||
      (row?.agentPhone as string | undefined),
    listingAgentEmail:
      (row?.listingAgent as Record<string, unknown> | undefined)?.email?.toString() ||
      (row?.agentEmail as string | undefined),
    photoUrl: photos[0],
    photos,
    mlsNumber: (row?.mlsNumber as string | undefined) || undefined,
    description: (row?.description as string | undefined) || undefined,
    provider: "rentcast",
  };
}

function buildQuery(input: ListingSearchInput): URL {
  const url = new URL("https://api.rentcast.io/v1/listings/sale");

  if (input.city) url.searchParams.set("city", input.city);
  if (input.state) url.searchParams.set("state", input.state);
  if (input.zip) url.searchParams.set("zipCode", input.zip);
  if (typeof input.maxPrice === "number" && input.maxPrice > 0) {
    url.searchParams.set("maxPrice", String(Math.round(input.maxPrice)));
  }
  if (typeof input.minPrice === "number" && input.minPrice > 0) {
    url.searchParams.set("minPrice", String(Math.round(input.minPrice)));
  }
  if (input.propertyType) {
    url.searchParams.set("propertyType", input.propertyType);
  }
  if (typeof input.beds === "number" && input.beds > 0) {
    url.searchParams.set("bedrooms", String(input.beds));
  }
  if (typeof input.baths === "number" && input.baths > 0) {
    url.searchParams.set("bathrooms", String(input.baths));
  }
  url.searchParams.set("limit", String(input.limit || 24));

  return url;
}

export const rentcastListingsAdapter: ListingsAdapter = {
  name: "rentcast",

  async searchHomes(input: ListingSearchInput): Promise<ListingResult[]> {
    const apiKey = process.env.RENTCAST_API_KEY;
    if (!apiKey) throw new Error("Missing RENTCAST_API_KEY");

    const res = await fetch(buildQuery(input).toString(), {
      headers: {
        Accept: "application/json",
        "X-Api-Key": apiKey,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error(`RentCast search failed with ${res.status}`);
    }

    const json: unknown = await res.json();
    const rows = Array.isArray(json)
      ? json
      : json &&
          typeof json === "object" &&
          "data" in json &&
          Array.isArray((json as { data: unknown }).data)
        ? (json as { data: Record<string, unknown>[] }).data
        : [];
    return rows
      .map((r) => normalizeListing(r as Record<string, unknown>))
      .filter((row) => row.id && row.price > 0);
  },

  async getListing(id: string): Promise<ListingResult | null> {
    const apiKey = process.env.RENTCAST_API_KEY;
    if (!apiKey) throw new Error("Missing RENTCAST_API_KEY");

    const res = await fetch(`https://api.rentcast.io/v1/listings/sale/${encodeURIComponent(id)}`, {
      headers: {
        Accept: "application/json",
        "X-Api-Key": apiKey,
      },
      cache: "no-store",
    });

    if (res.status === 404) return null;
    if (!res.ok) {
      throw new Error(`RentCast listing detail failed with ${res.status}`);
    }

    const json: unknown = await res.json();
    return normalizeListing(json as Record<string, unknown>);
  },
};
