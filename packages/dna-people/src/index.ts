// @helm/dna-people — People DNA: team members, roles, permissions, staff/contractors.
// Core package. MUST NOT import @helm/pack-* or apps/*. (enforced by scripts/check-boundaries.mjs)
// First extraction: pure org-membership RBAC (role vocabulary + management guards).
export * from "./roles";
