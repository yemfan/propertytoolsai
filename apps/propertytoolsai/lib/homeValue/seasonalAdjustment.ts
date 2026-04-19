/**
 * Seasonal adjustment multiplier based on NAR historical data.
 * Spring/summer listings sell 3-5% higher than winter in most US markets.
 *
 * Monthly indices derived from NAR existing-home-sales seasonal patterns.
 * Baseline month = annual average = 1.0
 */

/** Seasonal index by month (1 = January … 12 = December). */
const SEASONAL_INDEX: Record<number, number> = {
  1: 0.97, // January — weakest month
  2: 0.975, // February — slow recovery
  3: 0.99, // March — spring market begins
  4: 1.015, // April — spring ramp-up
  5: 1.03, // May — peak listing season
  6: 1.035, // June — peak selling season
  7: 1.025, // July — still strong
  8: 1.01, // August — tapering
  9: 1.0, // September — neutral
  10: 0.99, // October — fall slowdown
  11: 0.975, // November — pre-holiday dip
  12: 0.965, // December — holiday slowdown
};

/**
 * Returns a seasonal multiplier for the current month.
 * Optionally pass a month (1-12) for testing.
 */
export function seasonalMultiplier(
  month?: number
): { m: number; label: string } {
  const m = month ?? new Date().getMonth() + 1;
  const idx = SEASONAL_INDEX[m] ?? 1;
  const monthName = new Date(2024, m - 1, 1).toLocaleString("en-US", {
    month: "long",
  });
  return { m: idx, label: `Seasonal adjustment (${monthName})` };
}
