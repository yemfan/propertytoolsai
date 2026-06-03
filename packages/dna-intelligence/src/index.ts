// @helm/dna-intelligence — Intelligence DNA: scoring, predictions, KPI registry, Command Center read-model.
// Core package. MUST NOT import @helm/pack-* or apps/*. (enforced by scripts/check-boundaries.mjs)
// Pure cores: financial-report aggregation (P&L, AR aging) + the Command Center read-model.
export * from "./reporting";
export * from "./command-center";
