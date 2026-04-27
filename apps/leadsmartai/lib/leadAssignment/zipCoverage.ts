/**
 * Pure ZIP-coverage helpers for IDX lead routing.
 *
 * Each agent declares the ZIPs they service via the
 * `IDX_AGENT_ZIP_COVERAGE` env var (JSON object):
 *
 *   IDX_AGENT_ZIP_COVERAGE='{"agent-1":["94087","94088"],"agent-2":["78701"]}'
 *
 * The IDX lead-capture route resolves the lead's ZIP (from
 * `searchFilters.zip` first, then by extracting from
 * `listingAddress` as a fallback) and narrows the round-robin
 * allowlist to agents who cover it. If no listed agent covers the
 * ZIP, the picker falls back to the full allowlist — preferring an
 * imperfect-fit agent over silently dropping the lead.
 *
 * No I/O, no env reads here. The service layer reads the env once and
 * passes the parsed coverage map to these helpers.
 */

export type AgentZipCoverage = Map<string, Set<string>>;

/**
 * Parse the env JSON string into a Map<agentId, Set<zip>>. Permissive:
 * malformed input returns an empty map (never throws), and individual
 * malformed entries are skipped rather than failing the whole parse.
 *
 * Accepts ZIPs as 5-digit strings; entries with non-string ZIPs or
 * length != 5 are dropped.
 */
export function parseAgentZipCoverage(raw: string | null | undefined): AgentZipCoverage {
  const out: AgentZipCoverage = new Map();
  if (!raw || typeof raw !== "string" || !raw.trim()) return out;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return out;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return out;

  for (const [agentId, zips] of Object.entries(parsed as Record<string, unknown>)) {
    const trimmedAgent = agentId.trim();
    if (!trimmedAgent) continue;
    if (!Array.isArray(zips)) continue;
    const set = new Set<string>();
    for (const z of zips) {
      if (typeof z !== "string") continue;
      const trimmed = z.trim();
      if (!/^\d{5}$/.test(trimmed)) continue;
      set.add(trimmed);
    }
    if (set.size > 0) out.set(trimmedAgent, set);
  }
  return out;
}

/**
 * Narrow the round-robin allowlist to agents whose declared coverage
 * includes the lead's ZIP. Returns the original list when:
 *
 *   - No ZIP is provided (e.g. favorite without searchFilters)
 *   - Coverage map is empty (env unset)
 *   - No listed agent covers this ZIP
 *
 * The "no agent covers" fallback intentionally prefers any-agent over
 * dropping the lead. Better to assign imperfectly than to land in
 * the unassigned pool.
 */
export function filterAgentsByZip(
  eligibleAgentIds: ReadonlyArray<string>,
  leadZip: string | null | undefined,
  coverage: AgentZipCoverage,
): string[] {
  if (eligibleAgentIds.length === 0) return [];
  if (!leadZip || coverage.size === 0) return [...eligibleAgentIds];

  const normalizedZip = leadZip.trim();
  if (!/^\d{5}$/.test(normalizedZip)) return [...eligibleAgentIds];

  const matches: string[] = [];
  for (const id of eligibleAgentIds) {
    const zips = coverage.get(id);
    if (zips && zips.has(normalizedZip)) matches.push(id);
  }
  if (matches.length === 0) return [...eligibleAgentIds];
  return matches;
}

const FIVE_DIGIT_ZIP = /\b(\d{5})(?:-\d{4})?\b/;

/**
 * Best-effort: extract a 5-digit US ZIP from a free-form address string.
 * Used as a fallback when the consumer hasn't set `searchFilters.zip`
 * but has favorited or scheduled a tour on a listing whose
 * `listingAddress` is something like "1234 Elm St, Austin, TX 78701".
 *
 * Only matches the FIRST five-digit run, so we don't accidentally
 * pick up a street number that happens to be five digits.
 */
export function extractZipFromAddress(address: string | null | undefined): string | null {
  if (!address || typeof address !== "string") return null;
  // Skip leading street-number digits — the ZIP is virtually always after
  // a comma + state-code combination. Look for the rightmost five-digit
  // run instead, which avoids the "12345 Elm St" street-number false-positive.
  const reversed = address.split(/\s+/).reverse().join(" ");
  const m = reversed.match(FIVE_DIGIT_ZIP);
  return m ? m[1] : null;
}
