import type { AgentZipCoverage } from "@/lib/leadAssignment/zipCoverage";

/**
 * Pure helpers for the DB-backed routing config.
 *
 * Translates rows from `agent_lead_routing` into the same allowlist +
 * coverage shapes the existing pure picker expects, so the runtime
 * logic in `service.ts` doesn't have to branch on data source. Insulated
 * from DB types so tests can hit it without Supabase mocking.
 */

/**
 * Slim row shape — only the fields the picker cares about. The DB layer
 * projects DB rows onto this shape, the rest of the pipeline never sees
 * the raw row.
 */
export type RoutingRuleRow = {
  agentId: string;
  inRoundRobin: boolean;
  zipCoverage: ReadonlyArray<string>;
  /** Reserved for future weighted RR. Currently unused; see migration comment. */
  priority: number;
};

/**
 * Output shape consumed by the picker pipeline.
 */
export type RoutingConfig = {
  /** Agents enrolled in the round-robin pool (deduped, deterministic order). */
  allowlist: string[];
  /** ZIP-coverage map (matches the env-parsed shape so the existing filterAgentsByZip just works). */
  coverage: AgentZipCoverage;
};

/**
 * Build the runtime routing config from DB rows.
 *
 * Selection rules:
 *   * Only rows with `inRoundRobin = true` are included
 *   * Rows with empty `zipCoverage[]` are NOT added to the coverage map —
 *     that means "no constraint" (eligible for any ZIP). Adding an empty
 *     Set would make the agent ineligible for ZIP-narrowed pools.
 *   * Allowlist sorts by priority desc, then agentId asc — deterministic.
 *
 * ZIPs are filtered the same way the env parser filters: must be exactly
 * 5 digits. Junk values are dropped silently rather than failing the
 * whole config (which would be much more disruptive than ignoring one
 * malformed ZIP).
 */
export function buildRoutingConfigFromRows(
  rows: ReadonlyArray<RoutingRuleRow>,
): RoutingConfig {
  const enrolled = rows.filter((r) => r.inRoundRobin === true && r.agentId.trim().length > 0);

  const sorted = [...enrolled].sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return a.agentId < b.agentId ? -1 : a.agentId > b.agentId ? 1 : 0;
  });

  const seenIds = new Set<string>();
  const allowlist: string[] = [];
  for (const r of sorted) {
    const id = r.agentId.trim();
    if (seenIds.has(id)) continue;
    seenIds.add(id);
    allowlist.push(id);
  }

  const coverage: AgentZipCoverage = new Map();
  for (const r of enrolled) {
    const id = r.agentId.trim();
    if (!id) continue;
    const zips = new Set<string>();
    for (const z of r.zipCoverage ?? []) {
      if (typeof z !== "string") continue;
      const trimmed = z.trim();
      if (!/^\d{5}$/.test(trimmed)) continue;
      zips.add(trimmed);
    }
    if (zips.size > 0) coverage.set(id, zips);
  }

  return { allowlist, coverage };
}

/**
 * Sanitize the ZIP list a user submits via the settings UI. Returns:
 *   * Trimmed, deduped, sorted ascending
 *   * Only valid 5-digit US ZIPs (everything else dropped silently —
 *     the UI shows the cleaned list so the user sees what was kept)
 *
 * The UI accepts comma- or whitespace-separated input, so this also
 * handles the splitting (callers can pass either a string or an array).
 */
export function sanitizeZipCoverage(input: string | string[] | null | undefined): string[] {
  if (!input) return [];
  const tokens = Array.isArray(input)
    ? input
    : input.split(/[\s,]+/);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of tokens) {
    if (typeof t !== "string") continue;
    const trimmed = t.trim();
    if (!/^\d{5}$/.test(trimmed)) continue;
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  out.sort();
  return out;
}
