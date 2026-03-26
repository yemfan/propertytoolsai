import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../.env.local") });

async function main() {
  console.log("Smoke: run valuation auto-calibration (writes profiles + history)\n");

  const { runAutoCalibration, getCalibrationProfiles } = await import(
    "@/lib/valuation-calibration/service"
  );

  const { candidates, applied } = await runAutoCalibration();

  console.log(`Candidates: ${candidates.length}`);
  console.log(`Applied: ${applied.length}`);

  const profiles = await getCalibrationProfiles();
  console.log(`Profiles after run: ${profiles.length}`);

  if (profiles[0]) {
    const p = profiles[0];
    console.log(
      `Sample profile: ${p.scenarioKey} comps=${p.compsWeight.toFixed(3)} api=${p.apiWeight.toFixed(
        3
      )} trend=${p.trendWeight.toFixed(3)} tax=${p.taxWeight.toFixed(3)} cap=${p.conditionCapPct.toFixed(
        3
      )} v${p.version}`
    );
  }
}

void main().catch((err) => {
  console.error("Smoke run failed:", err);
  process.exit(1);
});

