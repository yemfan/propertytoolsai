/**
 * ML Model Inference Service — calls the trained XGBoost/LightGBM/sklearn
 * model to predict home values. Uses the Python predict.py script via
 * child_process.execFile.
 *
 * Architecture:
 * 1. Training (offline): `python train.py --csv data.csv` → joblib model
 * 2. Inference (runtime): Node.js → Python predict.py → JSON predictions
 *
 * Falls back gracefully when:
 * - Python is not installed
 * - Model artifact doesn't exist (not trained yet)
 * - Prediction fails for any reason
 *
 * The ML prediction is used as a THIRD signal alongside:
 * - Rentcast AVM (professional ML model)
 * - Comp-based PPSF × sqft (local heuristic)
 *
 * When all three agree, we have high confidence. When they diverge,
 * we widen the range band.
 */

import { execFile } from "child_process";
import { existsSync } from "fs";
import path from "path";

export type MlPredictionInput = {
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  lot_size: number | null;
  year_built: number | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  property_type: string | null;
  condition: string | null;
  /** Our pipeline's current estimate (the model can use this as a feature) */
  api_estimate: number | null;
  comps_estimate: number | null;
  final_estimate: number | null;
  low_estimate: number | null;
  high_estimate: number | null;
  confidence_score: number | null;
  comparable_count: number | null;
  weighted_ppsf: number | null;
};

export type MlPredictionResult = {
  prediction: number | null;
  available: boolean;
  error?: string;
};

/** Path to the ML model directory (relative to the app root) */
const ML_DIR = path.resolve(
  process.cwd(),
  "apps/propertytoolsai/ml/valuation"
);
const MODEL_DIR = path.resolve(ML_DIR, "artifacts/valuation_model");
const PREDICT_SCRIPT = path.resolve(ML_DIR, "predict.py");

/** Check if the model has been trained and artifacts exist */
function modelExists(): boolean {
  const modelPath = path.join(MODEL_DIR, "valuation_model.joblib");
  const schemaPath = path.join(MODEL_DIR, "schema.json");
  return existsSync(modelPath) && existsSync(schemaPath);
}

/** Find Python executable */
function findPython(): string | null {
  // Common Python paths on different platforms
  const candidates = ["python3", "python"];
  for (const cmd of candidates) {
    try {
      // Just return the name; execFile will resolve via PATH
      return cmd;
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * Run ML prediction for a single property.
 * Returns null prediction if model isn't available.
 * Never throws — all errors are caught and returned as result.error.
 */
export async function predictWithMlModel(
  input: MlPredictionInput
): Promise<MlPredictionResult> {
  if (!modelExists()) {
    return {
      prediction: null,
      available: false,
      error: "Model not trained yet",
    };
  }

  const python = findPython();
  if (!python) {
    return {
      prediction: null,
      available: false,
      error: "Python not found",
    };
  }

  // Build the input row as JSON
  const row = {
    beds: input.beds,
    baths: input.baths,
    sqft: input.sqft,
    lot_size: input.lot_size,
    year_built: input.year_built,
    city: input.city ?? "unknown",
    state: input.state ?? "unknown",
    zip: input.zip ?? "unknown",
    property_type: input.property_type ?? "single family",
    condition: input.condition ?? "average",
    confidence_label: "medium",
    tier_used: "pipeline",
    valuation_version: "v2",
    api_estimate: input.api_estimate,
    comps_estimate: input.comps_estimate,
    final_estimate: input.final_estimate,
    low_estimate: input.low_estimate,
    high_estimate: input.high_estimate,
    confidence_score: input.confidence_score,
    comparable_count: input.comparable_count,
    weighted_ppsf: input.weighted_ppsf,
    listing_trend_adjustment_pct: null,
    condition_adjustment_pct: null,
    range_spread_pct: null,
    tax_anchor_estimate: null,
    api_vs_comps_diff_pct: null,
    tax_vs_comps_diff_pct: null,
    tax_vs_api_diff_pct: null,
    months_since_last_sale: null,
    months_from_estimate_to_sale: null,
  };

  return new Promise<MlPredictionResult>((resolve) => {
    // Write input to a temp file and call predict.py
    const inputJson = JSON.stringify([row]);
    const tmpPath = path.join(MODEL_DIR, "_tmp_predict_input.json");

    try {
      require("fs").writeFileSync(tmpPath, inputJson, "utf-8");
    } catch (e) {
      resolve({
        prediction: null,
        available: false,
        error: `Failed to write temp input: ${e}`,
      });
      return;
    }

    const timeout = setTimeout(() => {
      resolve({
        prediction: null,
        available: true,
        error: "Prediction timed out (5s)",
      });
    }, 5000);

    execFile(
      python,
      [PREDICT_SCRIPT, "--model-dir", MODEL_DIR, "--input-json", tmpPath],
      { cwd: ML_DIR, timeout: 5000 },
      (err, stdout, stderr) => {
        clearTimeout(timeout);

        // Clean up temp file
        try {
          require("fs").unlinkSync(tmpPath);
        } catch {
          /* ignore */
        }

        if (err) {
          resolve({
            prediction: null,
            available: true,
            error: `Python error: ${err.message}`,
          });
          return;
        }

        try {
          const result = JSON.parse(stdout.trim());
          const predictions = result.predictions;
          if (
            Array.isArray(predictions) &&
            predictions.length > 0 &&
            typeof predictions[0] === "number" &&
            Number.isFinite(predictions[0]) &&
            predictions[0] > 0
          ) {
            console.log(
              `[mlInference] ML prediction: $${Math.round(predictions[0]).toLocaleString()}`
            );
            resolve({
              prediction: Math.round(predictions[0]),
              available: true,
            });
          } else {
            resolve({
              prediction: null,
              available: true,
              error: "Invalid prediction output",
            });
          }
        } catch (parseErr) {
          resolve({
            prediction: null,
            available: true,
            error: `Failed to parse output: ${stdout.slice(0, 200)}`,
          });
        }
      }
    );
  });
}
