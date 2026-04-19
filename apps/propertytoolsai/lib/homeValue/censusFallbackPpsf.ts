/**
 * Census ACS fallback PPSF — replaces hardcoded $245/sqft with
 * ZIP-level or county-level median derived from Census Bureau data.
 *
 * Uses the Census ACS 5-Year API (free, no key needed for low volume).
 * Falls back to $245 if Census data unavailable.
 *
 * B25077_001E = Median Value (Owner-Occupied Housing Units)
 * B25018_001E = Median Number of Rooms (proxy for size when sqft unavailable)
 *
 * We estimate PPSF as: median_home_value / estimated_median_sqft
 * where estimated_median_sqft ≈ median_rooms × 200 (rough but better than $245 nationally).
 */

/** In-memory cache: ZIP → { ppsf, fetchedAt } */
const cache = new Map<string, { ppsf: number; fetchedAt: number }>();
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const CENSUS_API_BASE = "https://api.census.gov/data";
const ACS_YEAR = "2022"; // latest available 5-year ACS
const ACS_DATASET = "acs/acs5";

// National fallback when everything else fails
const NATIONAL_FALLBACK_PPSF = 245;

// Rough sqft per room for census-based estimation
const SQFT_PER_ROOM = 200;

// Default median sqft when rooms data unavailable
const DEFAULT_MEDIAN_SQFT = 1650;

/**
 * Fetch median home value from Census ACS for a ZIP code (ZCTA).
 * Returns estimated PPSF or null on failure.
 */
async function fetchCensusZipMedian(zip: string): Promise<number | null> {
  try {
    const url = `${CENSUS_API_BASE}/${ACS_YEAR}/${ACS_DATASET}?get=B25077_001E,B25018_001E&for=zip%20code%20tabulation%20area:${zip}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;

    const data = await res.json();
    // Response: [[header row], [data row]]
    if (!Array.isArray(data) || data.length < 2) return null;

    const medianValue = Number(data[1][0]);
    const medianRooms = Number(data[1][1]);

    if (!medianValue || medianValue <= 0) return null;

    // Estimate median sqft from rooms, or use default
    const estSqft =
      medianRooms > 0 ? medianRooms * SQFT_PER_ROOM : DEFAULT_MEDIAN_SQFT;

    const ppsf = Math.round(medianValue / estSqft);
    return ppsf > 0 ? ppsf : null;
  } catch (e) {
    console.error(`[censusFallback] ZIP ${zip} fetch failed:`, e);
    return null;
  }
}

/**
 * Get fallback PPSF for a ZIP code. Checks in-memory cache first,
 * then fetches from Census ACS. Falls back to $245 if unavailable.
 */
export async function getCensusFallbackPpsf(zip?: string | null): Promise<number> {
  if (!zip?.trim()) return NATIONAL_FALLBACK_PPSF;

  const cleanZip = zip.trim().slice(0, 5);
  if (!/^\d{5}$/.test(cleanZip)) return NATIONAL_FALLBACK_PPSF;

  // Check cache
  const cached = cache.get(cleanZip);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.ppsf;
  }

  const ppsf = await fetchCensusZipMedian(cleanZip);
  if (ppsf != null) {
    cache.set(cleanZip, { ppsf, fetchedAt: Date.now() });
    console.log(`[censusFallback] ZIP ${cleanZip} PPSF: $${ppsf}/sqft`);
    return ppsf;
  }

  return NATIONAL_FALLBACK_PPSF;
}
