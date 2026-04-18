import type { PropertyCore } from "./propertyService";

/**
 * Stub fallback used by getPropertyData when no real data source is wired
 * up. Previously returned hard-coded demo values (Los Angeles, 3 bed,
 * 2 bath, 1500 sqft, $800k, $3200 rent) which ended up getting cached
 * and written into the warehouse `properties` table. That poisoned every
 * downstream consumer — the home-value estimate read `sqft=1500` from
 * the polluted warehouse row, and the pipeline's Rentcast enrichment
 * step only overrides when the incoming body value is null, so the
 * stub won silently even for addresses Rentcast had real data for.
 *
 * Real property data comes from the Rentcast adapter (see
 * lib/valuation/adapters/rentcast.ts), which is called directly by
 * runHomeValueEstimatePipeline. This stub exists only so the
 * getPropertyData / cache / warehouse-upsert plumbing still has a
 * shape to echo back. It MUST NOT fabricate numeric values — return
 * nulls so the warehouse stays clean and enrichment from Rentcast
 * can overwrite on every estimate run.
 */
export async function fetchPropertyData(
  address: string
): Promise<PropertyCore> {
  return {
    address,
    city: "",
    state: "",
    zip: "",
    beds: null,
    baths: null,
    sqft: null,
    price: null,
    rent: null,
  };
}
