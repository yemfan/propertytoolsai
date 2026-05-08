import { NextResponse } from "next/server";
import { getPropertyData } from "@/lib/getPropertyData";
import { fetchPropertyData } from "@/lib/services/fetchPropertyData";
import {
  detectPlatform,
  extractAddressFromListingUrl,
  extractListingId,
} from "@/lib/listingUrl";
import { fetchAndParseListing } from "@/lib/listingFetch";
import { savePropertyToCache } from "@/lib/propertyCache";
import { upsertPropertyWarehouse, insertSnapshotIfNeeded } from "@/lib/propertyService";

export const runtime = "nodejs";

/**
 * GET /api/property/from-listing?url=<listing-url>
 *
 * Resolves a property listing URL (Zillow / Redfin / Realtor / Compass)
 * into structured data + warehouse snapshot. Two data sources, merged:
 *
 *   1. **Listing-page scrape** (`fetchAndParseListing`) — pulls the
 *      JSON-LD embedded in the listing page. Reliable for price /
 *      beds / sqft / address, but Zillow-class sites don't expose
 *      `listing_status` or MLS# in their JSON-LD — those fields come
 *      back null.
 *
 *   2. **Rentcast** (`fetchPropertyData`) — authoritative MLS data
 *      keyed by address. Returns the live `status` (Active / Pending
 *      / Sold), `mlsNumber`, and listing agent contact info.
 *
 * Earlier versions of this route ran them as exclusive branches
 * (Zillow scrape OR Rentcast fallback). When Zillow scrape succeeded,
 * Rentcast was skipped — and so was the only source of MLS status.
 * Symptom: agent pastes a Zillow URL, scrape pulls price + sqft, but
 * the showing form shows "No MLS status on file" even though the
 * listing is live and Rentcast has it.
 *
 * The merge: scrape wins on basic property facts (the JSON-LD is
 * cleaner than Rentcast's denormalized rows for those), Rentcast
 * wins on MLS-specific fields (status / mls# / agent). Either side
 * can come back empty without breaking the other.
 */
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
        { error: "Unsupported URL. Use zillow.com, redfin.com, realtor.com, or compass.com." },
        { status: 400 },
      );
    }

    const id = extractListingId(listingUrl, platform);
    const addressFromSlug = extractAddressFromListingUrl(listingUrl);

    // Both sources fire in parallel — neither blocks the other.
    const [parsed, rentcast] = await Promise.all([
      // Best-effort scrape; throws → returns null inside the helper.
      fetchAndParseListing(listingUrl),
      // Rentcast needs an address. If we don't have one yet, pass the
      // slug-derived address (still usually a clean street + city +
      // state + zip). If even that's missing, skip Rentcast — the
      // scrape may yield an address that we'd then re-call Rentcast
      // with later.
      addressFromSlug ? fetchPropertyData(addressFromSlug).catch((e) => {
        console.warn("[from-listing] rentcast lookup failed:", e instanceof Error ? e.message : e);
        return null;
      }) : Promise.resolve(null),
    ]);

    // Prefer scrape's address (matches Zillow's display form) but fall
    // back to slug-parsed address. We send Rentcast the slug-form
    // address up front; if scrape comes back with a better address, we
    // could re-Rentcast — but for now, the slug form works for the
    // ~95% case (Zillow URLs include the full address in the path).
    const address = (parsed?.address ?? addressFromSlug) || null;
    if (!address) {
      return NextResponse.json(
        {
          error:
            platform === "zillow"
              ? "Could not extract address from Zillow URL."
              : platform === "redfin"
                ? "Could not extract address from Redfin URL."
                : platform === "realtor"
                  ? "Could not extract address from Realtor.com URL."
                  : "Could not extract address from Compass URL.",
        },
        { status: 400 },
      );
    }

    // ── Merge ────────────────────────────────────────────────────
    // Scrape (parsed) wins on basic property facts. Rentcast wins on
    // MLS-specific fields (status, mls#, agent) since the scrape
    // can't expose them. Both are nullable — fall through gracefully
    // when one side has nothing.
    const merged: Record<string, unknown> = {
      ...(parsed ?? {}),
      // Match existing shapes used across tools.
      zip: parsed?.zip_code ?? rentcast?.zip ?? null,
      lot_size: parsed?.lot_size ?? rentcast?.lot_size ?? null,
      year_built: parsed?.year_built ?? rentcast?.year_built ?? null,
      property_type: parsed?.property_type ?? rentcast?.property_type ?? null,
      // MLS authority — Rentcast wins, scrape only as null-safe fallback.
      listing_status:
        rentcast?.listing_status ?? parsed?.listing_status ?? null,
      mlsNumber: rentcast?.mlsNumber ?? null,
      mlsName: rentcast?.mlsName ?? null,
      listingAgentName: rentcast?.listingAgentName ?? null,
      listingAgentEmail: rentcast?.listingAgentEmail ?? null,
      listingAgentPhone: rentcast?.listingAgentPhone ?? null,
      // Price — scrape wins because Zillow's JSON-LD price is the
      // current asking; Rentcast's price field can lag by hours.
      price: parsed?.price ?? rentcast?.price ?? null,
    };

    // ── Persist + respond ────────────────────────────────────────
    let data: unknown = merged;
    if (parsed || rentcast) {
      const propertyRow = await upsertPropertyWarehouse({
        address,
        city: parsed?.city ?? rentcast?.city ?? null,
        state: parsed?.state ?? rentcast?.state ?? null,
        zip_code: parsed?.zip_code ?? rentcast?.zip ?? null,
        beds: parsed?.beds ?? rentcast?.beds ?? null,
        baths: parsed?.baths ?? rentcast?.baths ?? null,
        sqft: parsed?.sqft ?? rentcast?.sqft ?? null,
        lot_size: parsed?.lot_size ?? rentcast?.lot_size ?? null,
        year_built: parsed?.year_built ?? rentcast?.year_built ?? null,
        property_type: parsed?.property_type ?? rentcast?.property_type ?? null,
        lat: parsed?.lat ?? rentcast?.lat ?? null,
        lng: parsed?.lng ?? rentcast?.lng ?? null,
      });

      const estValue =
        (parsed?.price ?? rentcast?.price ?? null) as number | null;
      const sqftVal = (parsed?.sqft ?? rentcast?.sqft ?? null) as number | null;
      const ppsf =
        estValue != null && sqftVal != null && sqftVal > 0
          ? estValue / sqftVal
          : null;

      await insertSnapshotIfNeeded({
        propertyId: propertyRow.id,
        estimatedValue: estValue,
        rentEstimate: parsed?.rent_estimate ?? rentcast?.rent ?? null,
        pricePerSqft: ppsf,
        // The whole reason this PR exists: Rentcast's status replaces
        // Zillow scrape's null. Keeping the parsed fallback in case
        // Rentcast was skipped (no slug address).
        listingStatus:
          rentcast?.listing_status ?? parsed?.listing_status ?? null,
        data: merged,
      });

      await savePropertyToCache(address, merged, {
        city: propertyRow.city,
        state: propertyRow.state,
        zip_code: propertyRow.zip_code,
      });
    } else {
      // Neither source returned anything — fall back to the
      // address-only Rentcast lookup via getPropertyData (which has
      // its own cache layer + warehouse-write).
      data = await getPropertyData(address, refresh);
    }

    return NextResponse.json({
      ok: true,
      platform,
      id,
      address,
      data,
      // Telemetry for the client UI / debugging.
      sources: {
        scrape: parsed ? "ok" : "empty",
        rentcast: rentcast ? "ok" : "empty",
      },
      source: parsed ? "listing" : rentcast ? "rentcast" : "warehouse",
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Server error";
    console.error("from-listing error", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
