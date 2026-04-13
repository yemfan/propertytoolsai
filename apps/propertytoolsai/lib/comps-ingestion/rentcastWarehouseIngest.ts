import {
  detectWarehouseWriteTables,
  upsertPropertyWarehouse,
  type PropertyRow,
} from "@/lib/propertyService";
import { supabaseServer } from "@/lib/supabaseServer";
import { loadValuationBundleFromRentcast } from "@/lib/valuation/adapters/rentcast";
import type { SubjectPropertyInput } from "@/lib/valuation/types";
import { extractUsZipFromAddress } from "./addressZip";
import { normalizeWarehouseAddress } from "./normalize";

function rowToSubjectInput(row: PropertyRow): SubjectPropertyInput {
  return {
    address: row.address,
    city: row.city ?? undefined,
    state: row.state ?? undefined,
    zip: row.zip_code ?? undefined,
    lat: row.lat ?? undefined,
    lng: row.lng ?? undefined,
    beds: row.beds ?? undefined,
    baths: row.baths ?? undefined,
    sqft: row.sqft ?? undefined,
  };
}

/**
 * Pull Rentcast AVM sales for the subject, upsert comp properties + sold snapshots into the warehouse.
 * Tags `zip_code` with parsed comp ZIP or subject ZIP so `warehouse_property_ids_in_zip_with_sale_price` can find rows.
 */
export async function ingestRentcastSoldCompsForPropertyRow(
  subject: PropertyRow,
  maxComps = 30
): Promise<number> {
  if (!process.env.RENTCAST_API_KEY?.trim()) return 0;

  let bundle;
  try {
    bundle = await loadValuationBundleFromRentcast(rowToSubjectInput(subject));
  } catch (e) {
    console.error("[rentcast-ingest] loadValuationBundleFromRentcast THREW:", e);
    return 0;
  }
  console.log(
    `[rentcast-ingest] Bundle for "${subject.address}": ` +
    `comps=${bundle.comps.length}, ` +
    `activeListings=${bundle.activeListings.length}, ` +
    `apiEstimate=${bundle.apiEstimate}`
  );

  const tables = await detectWarehouseWriteTables();
  let inserted = 0;

  for (const c of bundle.comps) {
    if (inserted >= maxComps) break;
    if (!c.soldPrice || c.soldPrice <= 0) continue;

    const zipFromComp =
      (typeof c.zip === "string" && c.zip.trim()) || extractUsZipFromAddress(c.address);
    const zip = zipFromComp || subject.zip_code || null;

    const addrKey = normalizeWarehouseAddress(c.address);
    try {
      const prop = await upsertPropertyWarehouse({
        address: addrKey,
        city: subject.city ?? null,
        state: subject.state ?? null,
        zip_code: zip,
        lat: null,
        lng: null,
        beds: c.beds ?? null,
        baths: c.baths ?? null,
        sqft: c.sqft ?? null,
        year_built: c.yearBuilt ?? null,
        property_type: c.propertyType ?? null,
      });

      const sqftN = prop.sqft ?? c.sqft ?? null;
      const ppsf = sqftN != null && sqftN > 0 ? c.soldPrice / sqftN : null;
      const saleDate =
        c.soldDate && String(c.soldDate).trim() ? String(c.soldDate).slice(0, 10) : null;

      const { error } = await supabaseServer.from(tables.snapshots).insert({
        property_id: prop.id,
        estimated_value: c.soldPrice,
        rent_estimate: null,
        price_per_sqft: ppsf,
        listing_status: "sold",
        data: { sale_date: saleDate, source: "rentcast_comp_ingest" },
      });

      if (!error) inserted += 1;
    } catch {
      /* skip row */
    }
  }

  return inserted;
}
