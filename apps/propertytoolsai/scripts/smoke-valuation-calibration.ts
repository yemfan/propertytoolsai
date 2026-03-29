import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { CalibrationScenarioKey } from "@/lib/valuation-calibration/types";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../.env.local") });

const SCENARIOS: CalibrationScenarioKey[] = [
  "strong_comps",
  "medium_comps",
  "weak_comps",
  "tax_fallback",
  "api_only",
];

async function ensureTable(
  supabaseAdmin: { from: (name: string) => any },
  name: string
) {
  const { data, error } = await supabaseAdmin
    .from(name)
    .select("id")
    .limit(1);

  if (error) {
    throw new Error(`Table check failed for ${name}: ${error.message}`);
  }

  // Not all tables have `id` as a column name, but this selection is enough for existence check.
  return data;
}

async function main() {
  console.log("Smoke: valuation calibration schema + reads");

  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const { buildCalibrationCandidates, getCalibrationProfiles } = await import(
    "@/lib/valuation-calibration/service"
  );
  const { getCalibrationForScenario } = await import("@/lib/valuation-calibration/apply");

  await ensureTable(supabaseAdmin, "valuation_calibration_profiles");
  await ensureTable(supabaseAdmin, "valuation_calibration_history");

  const profiles = await getCalibrationProfiles();
  console.log(`Loaded calibration profiles: ${profiles.length}`);

  for (const scenarioKey of SCENARIOS) {
    // Keep inputs minimal; classifyValuationScenario depends on comparable_count/api_estimate/tier_used.
    const input =
      scenarioKey === "strong_comps"
        ? { comparableCount: 6, hasApiEstimate: true }
        : scenarioKey === "medium_comps"
          ? { comparableCount: 4, hasApiEstimate: true }
          : scenarioKey === "weak_comps"
            ? { comparableCount: 1, hasApiEstimate: true }
            : scenarioKey === "tax_fallback"
              ? { comparableCount: 1, hasApiEstimate: false, tierUsed: "tax:heavy" }
              : { comparableCount: 0, hasApiEstimate: true };

    const app = await getCalibrationForScenario(input);
    console.log(
      `Scenario ${app.scenarioKey}: comps=${app.compsWeight.toFixed(3)} api=${app.apiWeight.toFixed(
        3
      )} trend=${app.trendWeight.toFixed(3)} tax=${app.taxWeight.toFixed(3)} cap=${app.conditionCapPct.toFixed(
        3
      )}`
    );
  }

  // Pure read path: build candidates (reads valuation_runs).
  const candidates = await buildCalibrationCandidates();
  console.log(`Built calibration candidates: ${candidates.length}`);
  console.log(
    candidates
      .map((c) => `${c.scenarioKey} n=${c.sampleSize} medianErr=${c.medianErrorPct}% inside=${c.insideRangePct}%`)
      .join("\n")
  );

  console.log("Smoke complete (read-only).");
}

void main().catch((err) => {
  console.error("Smoke failed:", err);
  process.exit(1);
});

