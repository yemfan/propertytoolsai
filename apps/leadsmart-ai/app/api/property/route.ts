import { NextResponse } from "next/server";
import { getPropertyData } from "@/lib/getPropertyData";
import { fetchAndParseListing } from "@/lib/listingFetch";
import { detectPlatform, extractAddressFromListingUrl } from "@/lib/listingUrl";
import { savePropertyToCache } from "@/lib/propertyCache";
import { insertSnapshotIfNeeded, upsertPropertyWarehouse } from "@/lib/propertyService";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const address = url.searchParams.get("address")?.trim() ?? "";
    const refresh = url.searchParams.get("refresh") === "true";

    if (!address) {
      return NextResponse.json(
        { error: "address is required" },
        { status: 400 }
      );
    }

    // Allow passing Zillow/Redfin listing URLs into this endpoint too.
    const isUrl = /^https?:\/\//i.test(address);
    if (isUrl) {
      const platform = detectPlatform(address);
      if (!platform) {
        return NextResponse.json(
          { error: "Unsupported URL. Use zillow.com or redfin.com." },
          { status: 400 }
        );
      }

      const parsed = await fetchAndParseListing(address);
      const addressFromSlug = extractAddressFromListingUrl(address);
      const resolvedAddress = (parsed?.address ?? addressFromSlug)?.trim() ?? "";
      if (!resolvedAddress) {
        return NextResponse.json(
          { error: "Could not extract address from listing URL." },
          { status: 400 }
        );
      }

      if (parsed) {
        const propertyRow = await upsertPropertyWarehouse({
          address: resolvedAddress,
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
          data: parsed,
        });

        await savePropertyToCache(resolvedAddress, parsed, {
          city: propertyRow.city,
          state: propertyRow.state,
          zip_code: propertyRow.zip_code,
        });

        return NextResponse.json({
          ok: true,
          data: parsed,
          cached: false,
          source: "listing",
          platform,
          address: resolvedAddress,
        });
      }

      // If parsing fails (or fetching disabled), fall back to address-based warehouse flow.
      const data = await getPropertyData(resolvedAddress, refresh);
      return NextResponse.json({
        ok: true,
        data,
        cached: !refresh,
        source: "warehouse",
        platform,
        address: resolvedAddress,
      });
    }

    const data = await getPropertyData(address, refresh);

    return NextResponse.json({ ok: true, data, cached: !refresh });
  } catch (e: any) {
    console.error("property API error", e);
    return NextResponse.json(
      { error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}

