// Payee normalization now lives in @helm/dna-finance (Finance DNA) — used by
// transaction auto-categorization + payee→category memory. Behavior-preserving re-export.
export { normalizePayee } from "@helm/dna-finance";
