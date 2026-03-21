import { NextResponse } from "next/server";
import { getPropertyData } from "@/lib/getPropertyData";
import {
  detectPlatform,
  extractAddressFromListingUrl,
  extractListingId,
} from "@/lib/listingUrl";
import { fetchAndParseListing } from "@/lib/listingFetch";
import { savePropertyToCache } from "@/lib/propertyCache";
import { upsertPropertyWarehouse, insertSnapshotIfNeeded } from "@/lib/propertyService";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const listingUrl = url.searchParams.get("url") ?? "";
    const refresh = url.searchParams.get("refresh") === "true";

    if (!listingUrl.trim()) {
      return NextResponse.json({ error: "url is required" }, { status: 400 });
    }

    const platform = detectPlatform(listingUrl);
    if (!platform) {
      return NextResponse.json(
        { error: "Unsupported URL. Use zillow.com or redfin.com." },
        { status: 400 }
      );
    }

    const id = extractListingId(listingUrl, platform);
    const addressFromSlug = extractAddressFromListingUrl(listingUrl);

    // Best-effort: fetch listing and parse embedded JSON (if enabled).
    const parsed = await fetchAndParseListing(listingUrl);
    const address = (parsed?.address ?? addressFromSlug) || null;
    if (!address) {
      return NextResponse.json(
        {
          error:
            platform === "zillow"
              ? "Could not extract address from Zillow URL."
              : "Could not extract address from Redfin URL.",
        },
        { status: 400 }
      );
    }

    // If we parsed concrete listing data, ingest it directly; otherwise fallback to address-based source.
    let data: unknown;
    if (parsed) {
      data = {
        ...parsed,
        // match existing shapes used across tools
        zip: parsed.zip_code ?? null,
        lot_size: parsed.lot_size ?? null,
        year_built: parsed.year_built ?? null,
        property_type: parsed.property_type ?? null,
      };

      const propertyRow = await upsertPropertyWarehouse({
        address,
        city: parsed.city ?? null,
        state: parsed.state ?? null,
        zip_code: parsed.zip_code ?? null,
        beds: parsed.beds ?? null,
        baths: parsed.baths ?? null,
        sqft: parsed.sqft ?? null,
        lot_size: parsed.lot_size ?? null,
        year_built: parsed.year_built ?? null,
        property_type: parsed.property_type ?? null,
        lat: parsed.lat ?? null,
        lng: parsed.lng ?? null,
      });

      const estValue = parsed.price ?? null;
      const ppsf =
        estValue != null && parsed.sqft != null && parsed.sqft > 0
          ? estValue / parsed.sqft
          : null;

      await insertSnapshotIfNeeded({
        propertyId: propertyRow.id,
        estimatedValue: estValue,
        rentEstimate: parsed.rent_estimate ?? null,
        pricePerSqft: ppsf,
        listingStatus: parsed.listing_status ?? null,
        data,
      });

      await savePropertyToCache(address, data, {
        city: propertyRow.city,
        state: propertyRow.state,
        zip_code: propertyRow.zip_code,
      });
    } else {
      data = await getPropertyData(address, refresh);
    }

    return NextResponse.json({
      ok: true,
      platform,
      id,
      address,
      data,
      source: parsed ? "listing" : "warehouse",
    });
  } catch (e: any) {
    console.error("from-listing error", e);
    return NextResponse.json(
      { error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}

