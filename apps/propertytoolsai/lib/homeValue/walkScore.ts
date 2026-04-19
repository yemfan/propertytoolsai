/**
 * Walk Score API integration — fetches walkability, transit, and bike scores
 * for a given lat/lng. Free tier allows 5,000 requests/day.
 *
 * @see https://www.walkscore.com/professional/api.php
 */

const WALK_SCORE_API = "https://api.walkscore.com/score";

export type WalkScoreResult = {
  walkScore: number | null;
  transitScore: number | null;
  bikeScore: number | null;
};

/**
 * Fetch Walk Score for a property. Returns null scores on failure.
 * Requires WALKSCORE_API_KEY env var.
 */
export async function fetchWalkScore(
  lat: number,
  lng: number,
  address?: string
): Promise<WalkScoreResult> {
  const apiKey = process.env.WALKSCORE_API_KEY?.trim();
  if (!apiKey) {
    return { walkScore: null, transitScore: null, bikeScore: null };
  }

  try {
    const params = new URLSearchParams({
      format: "json",
      lat: String(lat),
      lon: String(lng),
      transit: "1",
      bike: "1",
      wsapikey: apiKey,
    });
    if (address) params.set("address", address);

    const res = await fetch(`${WALK_SCORE_API}?${params}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { walkScore: null, transitScore: null, bikeScore: null };

    const data = await res.json();
    return {
      walkScore: typeof data.walkscore === "number" ? data.walkscore : null,
      transitScore: typeof data.transit?.score === "number" ? data.transit.score : null,
      bikeScore: typeof data.bike?.score === "number" ? data.bike.score : null,
    };
  } catch (e) {
    console.error("[walkScore] fetch failed:", e);
    return { walkScore: null, transitScore: null, bikeScore: null };
  }
}

/**
 * Walk Score → property value multiplier.
 * High walkability (90+) commands a 3% premium in urban markets.
 * Low walkability (<50) applies a modest discount in urban contexts,
 * but is neutral in suburban/rural where low walk scores are expected.
 */
export function walkScoreMultiplier(
  walkScore: number | null
): { m: number; label: string } {
  if (walkScore == null) return { m: 1, label: "Walk Score (not available)" };

  if (walkScore >= 90) return { m: 1.03, label: `Walk Score ${walkScore} (Walker's Paradise)` };
  if (walkScore >= 70) return { m: 1.015, label: `Walk Score ${walkScore} (Very Walkable)` };
  if (walkScore >= 50) return { m: 1.0, label: `Walk Score ${walkScore} (Somewhat Walkable)` };
  if (walkScore >= 25) return { m: 0.99, label: `Walk Score ${walkScore} (Car-Dependent)` };
  return { m: 0.98, label: `Walk Score ${walkScore} (Almost All Errands Require a Car)` };
}
