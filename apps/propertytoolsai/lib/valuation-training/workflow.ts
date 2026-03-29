import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { promisify } from "node:util";

import { activateModel, registerModel } from "@/lib/ml-registry/service";
import { rowsToCsv } from "@/lib/valuation-training/csv";
import { getTrainingDataset, type TrainingDatasetFilters } from "@/lib/valuation-training/service";
import { VALUATION_TRAINING_FIELDS } from "@/lib/valuation-training/trainingColumns";

const execFileAsync = promisify(execFile);

function resolveAppRoot(): string {
  const cwd = process.cwd();
  const candidates = [cwd, join(cwd, "apps", "propertytoolsai")];
  for (const root of candidates) {
    if (existsSync(join(root, "ml", "valuation", "train.py"))) return root;
  }
  return cwd;
}

function pythonExecutable(): string {
  return process.platform === "win32" ? "python" : "python3";
}

function buildModelVersion(): string {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  return `valuation_avm_${stamp}`;
}

function toPosixRelPath(fromRoot: string, absolutePath: string): string {
  return relative(fromRoot, absolutePath).split("\\").join("/");
}

type TrainingScriptResult = {
  model_path: string;
  schema_path: string;
  metrics_path: string;
  metrics: Record<string, unknown>;
  rows_used: number;
};

export async function runValuationTrainWorkflow(params: {
  exportName?: string;
  filters?: Record<string, unknown>;
  activateAfterTraining?: boolean;
  trainedBy?: string | null;
  notes?: string | null;
  minRows?: number;
}) {
  const appRoot = resolveAppRoot();
  const exportName =
    params.exportName || `valuation_training_${new Date().toISOString().slice(0, 10)}`;
  const rawFilters = params.filters ?? {};
  const trainingFilters: TrainingDatasetFilters = {
    limit:
      typeof rawFilters.limit === "number" && Number.isFinite(rawFilters.limit)
        ? Math.min(100_000, Math.max(1, rawFilters.limit))
        : 80_000,
    requireSqft: Boolean(rawFilters.requireSqft),
    minComparableCount:
      typeof rawFilters.minComparableCount === "number" && Number.isFinite(rawFilters.minComparableCount)
        ? rawFilters.minComparableCount
        : undefined,
    minSaleDate: typeof rawFilters.minSaleDate === "string" ? rawFilters.minSaleDate : undefined,
    maxSaleDate: typeof rawFilters.maxSaleDate === "string" ? rawFilters.maxSaleDate : undefined,
    cities: Array.isArray(rawFilters.cities) ? (rawFilters.cities as string[]) : undefined,
    states: Array.isArray(rawFilters.states) ? (rawFilters.states as string[]) : undefined,
    propertyTypes: Array.isArray(rawFilters.propertyTypes) ? (rawFilters.propertyTypes as string[]) : undefined,
    confidenceLabels: Array.isArray(rawFilters.confidenceLabels)
      ? (rawFilters.confidenceLabels as Array<"high" | "medium" | "low">)
      : undefined,
    maxErrorPct:
      typeof rawFilters.maxErrorPct === "number" && Number.isFinite(rawFilters.maxErrorPct)
        ? rawFilters.maxErrorPct
        : undefined,
    requireApiEstimate: Boolean(rawFilters.requireApiEstimate),
    requireCompsEstimate: Boolean(rawFilters.requireCompsEstimate),
  };
  const modelVersion = buildModelVersion();
  const minRows = params.minRows ?? 30;

  const rows = await getTrainingDataset(trainingFilters);
  if (rows.length < minRows) {
    throw new Error(`Not enough labeled rows to train. Need at least ${minRows} rows (got ${rows.length}).`);
  }

  const workdir = join(appRoot, "tmp", "valuation_training");
  const csvPath = join(workdir, `${exportName}.csv`);
  const artifactDirAbs = join(appRoot, "ml", "valuation", "artifacts", modelVersion);

  await mkdir(workdir, { recursive: true });
  await mkdir(artifactDirAbs, { recursive: true });

  const records = rows.map((r) => ({ ...r }) as Record<string, unknown>);
  const columns = Object.keys(records[0] ?? {}) as string[];
  const ordered = VALUATION_TRAINING_FIELDS.filter((c) => columns.includes(c));
  const orderedSet = new Set<string>(ordered);
  const extra = columns.filter((c) => !orderedSet.has(c)).sort();
  await writeFile(csvPath, rowsToCsv(records, [...ordered, ...extra]), "utf8");

  const mlValuationDir = join(appRoot, "ml", "valuation");
  const py = pythonExecutable();
  const args = [
    join(mlValuationDir, "train.py"),
    "--csv",
    csvPath,
    "--out-dir",
    artifactDirAbs,
    "--min-rows",
    String(minRows),
  ];

  let stdout = "";
  let stderr = "";
  try {
    const result = await execFileAsync(py, args, {
      cwd: mlValuationDir,
      env: { ...process.env },
      maxBuffer: 50 * 1024 * 1024,
    });
    stdout = result.stdout?.toString() ?? "";
    stderr = result.stderr?.toString() ?? "";
  } catch (err: unknown) {
    const e = err as { stdout?: Buffer; stderr?: Buffer; message?: string };
    stdout = e.stdout?.toString() ?? "";
    stderr = e.stderr?.toString() ?? "";
    throw new Error(
      `Python training failed: ${e.message ?? err}\n${stderr.slice(-4000)}`
    );
  }

  const outputText = stdout.trim();
  if (!outputText) {
    throw new Error(`Training script returned no stdout.${stderr ? `\n${stderr.slice(-2000)}` : ""}`);
  }

  let parsed: TrainingScriptResult;
  try {
    parsed = JSON.parse(outputText) as TrainingScriptResult;
  } catch {
    throw new Error(`Unable to parse training output: ${outputText.slice(0, 2000)}`);
  }

  const modelPathAbs = parsed.model_path;
  const schemaPathAbs = parsed.schema_path;
  if (!modelPathAbs || !schemaPathAbs) {
    throw new Error("Training output missing model_path or schema_path");
  }

  const artifactPathRel = toPosixRelPath(appRoot, modelPathAbs);
  const schemaPathRel = toPosixRelPath(appRoot, schemaPathAbs);

  const registered = await registerModel({
    modelKey: "valuation_avm",
    modelVersion,
    backend: String(parsed.metrics?.backend ?? "unknown"),
    artifactPath: artifactPathRel,
    schemaPath: schemaPathRel,
    metrics: parsed.metrics ?? {},
    filters: rawFilters,
    rowsUsed: Number(parsed.rows_used ?? rows.length),
    trainedBy: params.trainedBy ?? null,
    notes: params.notes ?? null,
    status: params.activateAfterTraining ? "active" : "candidate",
    isActive: Boolean(params.activateAfterTraining),
  });

  if (params.activateAfterTraining) {
    await activateModel(registered.id, "valuation_avm");
  }

  return {
    exportName,
    rowCount: rows.length,
    modelVersion,
    trainingOutput: parsed,
    registered,
    csvPath: toPosixRelPath(appRoot, csvPath),
    stderr: stderr.trim() || undefined,
  };
}
