import {
  detectWarehouseWriteTables,
  getComparables,
  upsertPropertyWarehouse,
  type PropertyCompRow,
} from "@/lib/propertyService";
import { supabaseServer } from "@/lib/supabaseServer";
import { extractUsZipFromAddress } from "./addressZip";
import { normalizeWarehouseAddress } from "./normalize";
import {
  COMP_SEARCH_TIERS,
  attachWarehouseSoldSnapshot,
  isValidSoldComparable,
  searchWarehouseNeighborCandidates,
  similarityRank,
} from "./neighbors";
import { fetchNearbySoldCompsFromUpstream, fetchSubjectFromUpstream } from "./rentcastUpstream";
import { resolveSubjectFromWarehouse, upsertSubjectIntoWarehouse } from "./subject";
import type { CompIngestionStats, NearbyCompCandidate, SubjectLookupResult } from "./types";

function propertyCompRowToNearby(c: PropertyCompRow): NearbyCompCandidate {
  const p = c.comp_property;
  return {
    externalId: c.comp_property_id,
    address: p?.address ?? "",
    city: p?.city ?? null,
    state: p?.state ?? null,
    zipCode: p?.zip_code ?? null,
    lat: p?.lat ?? null,
    lng: p?.lng ?? null,
    beds: p?.beds ?? null,
    baths: p?.baths ?? null,
    sqft: p?.sqft ?? null,
    yearBuilt: p?.year_built ?? null,
    propertyType: p?.property_type ?? null,
    soldPrice: c.sold_price,
    soldDate: c.sold_date,
    listingStatus: "sold",
    distanceMiles: c.distance_miles,
  };
}

async function loadCompsViaWarehouseEngine(
  subject: SubjectLookupResult,
  targetCompCount: number
): Promise<NearbyCompCandidate[]> {
  const { comps } = await getComparables(subject.normalizedAddress, targetCompCount);
  return comps.map(propertyCompRowToNearby);
}

async function upsertUpstreamCompIntoWarehouse(comp: NearbyCompCandidate) {
  const addrKey = normalizeWarehouseAddress(comp.address);
  const row = await upsertPropertyWarehouse({
    address: addrKey,
    city: comp.city ?? null,
    state: comp.state ?? null,
    zip_code: comp.zipCode ?? extractUsZipFromAddress(comp.address) ?? null,
    lat: comp.lat ?? null,
    lng: comp.lng ?? null,
    property_type: comp.propertyType ?? null,
    beds: comp.beds ?? null,
    baths: comp.baths ?? null,
    sqft: comp.sqft ?? null,
    year_built: comp.yearBuilt ?? null,
  });

  if (comp.soldPrice && comp.soldPrice > 0) {
    const tables = await detectWarehouseWriteTables();
    const sqft = row.sqft ?? comp.sqft ?? null;
    const ppsf =
      sqft != null && sqft > 0 ? comp.soldPrice / sqft : null;
    const saleDate =
      comp.soldDate && String(comp.soldDate).trim()
        ? String(comp.soldDate).slice(0, 10)
        : null;

    const { error: snapshotError } = await supabaseServer.from(tables.snapshots).insert({
      property_id: row.id,
      estimated_value: comp.soldPrice,
      rent_estimate: null,
      price_per_sqft: ppsf,
      listing_status: "sold",
      data: {
        sale_date: saleDate,
        source: "comps_ingestion_rentcast",
      },
    });

    if (snapshotError) {
      console.error("comps-ingestion: snapshot insert", snapshotError);
      throw snapshotError;
    }
  }

  return row.id;
}

/**
 * Progressive warehouse tiers, then Rentcast ingest + `getComparables` retry when coverage is weak.
 */
export async function resolveSubjectAndComparables(address: string, targetCompCount = 5) {
  const stats: CompIngestionStats = {
    subjectResolved: false,
    subjectInserted: false,
    warehouseCandidatesScanned: 0,
    warehouseValidSoldComps: 0,
    upstreamCandidatesFetched: 0,
    upstreamSoldCompsInserted: 0,
    finalValidCompCount: 0,
    fallbackUsed: false,
    notes: [],
  };

  let subject: SubjectLookupResult | null = await resolveSubjectFromWarehouse(address);

  if (!subject) {
    const upstreamSubject = await fetchSubjectFromUpstream(address);
    if (upstreamSubject?.subjectId) {
      stats.subjectInserted = true;
      stats.notes.push("Subject was missing from warehouse; hydrated via upstream fetch + warehouse upsert.");
      subject = upstreamSubject;
    }
  }

  if (!subject) {
    stats.notes.push("Subject could not be resolved from warehouse or upstream.");
    return { subject: null, comps: [] as NearbyCompCandidate[], stats, tierUsed: null as string | null };
  }

  stats.subjectResolved = true;

  const minAccept = Math.min(3, targetCompCount);
  let allValid: NearbyCompCandidate[] = [];
  let tierUsed: string | null = null;

  const neighborPool = await searchWarehouseNeighborCandidates(subject, 300);
  const rankedNeighbors = [...neighborPool].sort(
    (a, b) => similarityRank(subject, b) - similarityRank(subject, a)
  );

  for (const tier of COMP_SEARCH_TIERS) {
    const tierValid: NearbyCompCandidate[] = [];

    for (let i = 0; i < Math.min(rankedNeighbors.length, 250); i += tier.batchSize) {
      const batch = rankedNeighbors.slice(i, i + tier.batchSize);
      const snapshotRows = await Promise.all(batch.map((c) => attachWarehouseSoldSnapshot(c)));
      stats.warehouseCandidatesScanned += batch.length;

      for (const snap of snapshotRows) {
        if (!snap) continue;
        const check = isValidSoldComparable(subject, snap, tier);
        if (check.valid) tierValid.push(snap);
      }

      if (tierValid.length >= targetCompCount) break;
    }

    if (tierValid.length >= minAccept) {
      allValid = tierValid.slice(0, targetCompCount);
      stats.warehouseValidSoldComps = tierValid.length;
      tierUsed = tier.key;
      break;
    }
  }

  if (allValid.length < minAccept) {
    stats.fallbackUsed = true;
    stats.notes.push("Warehouse tier search was insufficient; running Rentcast comp ingest + warehouse retry.");

    const fallbackTier = COMP_SEARCH_TIERS[COMP_SEARCH_TIERS.length - 1]!;
    const upstreamCandidates = await fetchNearbySoldCompsFromUpstream(
      subject,
      fallbackTier.maxMiles,
      120
    );
    stats.upstreamCandidatesFetched = upstreamCandidates.length;

    for (const candidate of upstreamCandidates) {
      const check = isValidSoldComparable(subject, candidate, fallbackTier);
      if (!check.valid) continue;
      try {
        await upsertUpstreamCompIntoWarehouse(candidate);
        stats.upstreamSoldCompsInserted += 1;
      } catch (e) {
        stats.notes.push(`Skipped comp ingest for "${candidate.address}": ${String((e as Error)?.message ?? e)}`);
      }
    }

    allValid = await loadCompsViaWarehouseEngine(subject, targetCompCount);
    tierUsed = "upstream_recovery";
  }

  stats.finalValidCompCount = allValid.length;

  if (allValid.length < minAccept) {
    stats.notes.push(
      "Fewer than 3 valid sold comps after fallback; downstream valuation should lower confidence."
    );
  }

  return { subject, comps: allValid, stats, tierUsed };
}
