import { NextResponse } from "next/server";
import { getListingsAdapter } from "@/lib/listings/adapters";
import type { ListingSearchInput } from "@/lib/listings/adapters/types";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const maxPrice = Number(searchParams.get("maxPrice") || 0);
    const minPrice = Number(searchParams.get("minPrice") || 0);
    const zip = searchParams.get("zip") || "";
    const city = searchParams.get("city") || "";
    const state = searchParams.get("state") || "CA";
    const propertyTypeRaw = searchParams.get("propertyType") || "";
    const beds = Number(searchParams.get("beds") || 0);
    const baths = Number(searchParams.get("baths") || 0);
    const limit = Number(searchParams.get("limit") || 24);

    const propertyType = propertyTypeRaw
      ? (propertyTypeRaw as ListingSearchInput["propertyType"])
      : undefined;

    const adapter = getListingsAdapter();
    const results = await adapter.searchHomes({
      maxPrice: maxPrice || undefined,
      minPrice: minPrice || undefined,
      zip: zip || undefined,
      city: city || undefined,
      state: state || undefined,
      propertyType,
      beds: beds || undefined,
      baths: baths || undefined,
      limit: Number.isFinite(limit) && limit > 0 ? limit : 24,
    });

    return NextResponse.json({
      success: true,
      provider: adapter.name,
      results,
      criteria: {
        maxPrice,
        minPrice,
        zip,
        city,
        state,
        propertyType: propertyTypeRaw,
        beds,
        baths,
        limit: Number.isFinite(limit) && limit > 0 ? limit : 24,
      },
    });
  } catch (error) {
    console.error("homes in budget search error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to load homes in budget",
      },
      { status: 500 }
    );
  }
}
