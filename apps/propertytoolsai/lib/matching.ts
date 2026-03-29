/**
 * Agent matching for high-intent leads (e.g. AI Property Comparison → Talk to an Expert).
 * Match by geographic fit (service_areas) and availability (accepts_new_leads handled by caller).
 */

export type LeadLocationSignals = {
  /** Normalized lowercase city token */
  city: string;
  /** 5-digit zip or null */
  zip: string | null;
  /** 2-letter state if parsed */
  state: string | null;
};

export type MatchableAgent = {
  id: string;
  /** Lowercase city names and/or 5-digit zips */
  serviceAreas: string[];
  acceptsNewLeads: boolean;
  /**
   * Optional 0–1 score for capacity (e.g. fewer active leads = higher).
   * Defaults to 0.5 when omitted.
   */
  availabilityScore?: number;
};

export type MatchedAgent = MatchableAgent & {
  matchScore: number;
};

const STOP = new Set([
  "usa",
  "us",
  "united",
  "states",
  "ca",
  "tx",
  "fl",
  "ny",
  "st",
  "ave",
  "rd",
  "blvd",
  "dr",
]);

/**
 * Derive city / zip / state heuristics from a US-style address string.
 */
export function parseLeadAddress(address: string): LeadLocationSignals {
  const clean = address.trim();
  const zipMatch = clean.match(/\b(\d{5})(?:-\d{4})?\b/);
  const zip = zipMatch ? zipMatch[1] : null;
  const parts = clean.split(",").map((p) => p.trim()).filter(Boolean);
  let city = "";
  let state: string | null = null;
  if (parts.length >= 2) {
    city = parts[parts.length - 2] || "";
    const last = parts[parts.length - 1] || "";
    const st = last.match(/\b([A-Za-z]{2})\b/);
    state = st ? st[1].toUpperCase() : null;
  } else {
    const tokens = clean.split(/\s+/).filter(Boolean);
    for (let i = tokens.length - 1; i >= 0; i--) {
      const t = tokens[i];
      if (/^\d{5}/.test(t)) continue;
      if (t.length === 2 && /^[A-Za-z]{2}$/.test(t)) {
        state = t.toUpperCase();
        break;
      }
    }
    city = parts[0] || tokens.slice(0, 3).join(" ") || "local";
  }

  const cityNorm = normalizePlaceToken(city);

  return {
    city: cityNorm,
    zip,
    state,
  };
}

function normalizePlaceToken(s: string): string {
  const t = s
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!t) return "";
  const words = t.split(" ").filter((w) => w.length > 1 && !STOP.has(w));
  return words.join(" ") || t;
}

function areaMatches(needle: string, area: string): boolean {
  const a = area.toLowerCase().trim();
  const n = needle.toLowerCase().trim();
  if (!a || !n) return false;
  if (/^\d{5}$/.test(a) && /^\d{5}$/.test(n)) return a === n;
  return n.includes(a) || a.includes(n);
}

/**
 * Score agents by fit to the lead's location. Agents with empty `serviceAreas`
 * remain eligible with a baseline score (national / unscoped brokers).
 */
export function scoreAgentForLead(
  lead: LeadLocationSignals,
  agent: MatchableAgent
): number {
  if (!agent.acceptsNewLeads) return -1;

  const avail = Number.isFinite(agent.availabilityScore ?? NaN)
    ? Math.min(1, Math.max(0, agent.availabilityScore as number))
    : 0.5;

  const areas = agent.serviceAreas.map((x) => x.trim()).filter(Boolean);
  let geo = 0;

  if (areas.length === 0) {
    geo = 35;
  } else {
    let best = 0;
    for (const area of areas) {
      const a = area.toLowerCase();
      if (lead.zip && /^\d{5}$/.test(a) && a === lead.zip) {
        best = Math.max(best, 100);
      } else if (lead.city && areaMatches(lead.city, a)) {
        best = Math.max(best, 85);
      } else if (lead.zip && a.includes(lead.zip)) {
        best = Math.max(best, 95);
      } else if (lead.state && a.length === 2 && a.toUpperCase() === lead.state) {
        best = Math.max(best, 25);
      }
    }
    geo = best;
  }

  return geo + avail * 20;
}

/**
 * Return top-ranked agents for assignment / notifications.
 */
export function matchAgents(
  lead: LeadLocationSignals,
  agents: MatchableAgent[],
  opts?: { limit?: number }
): MatchedAgent[] {
  const limit = opts?.limit ?? 3;
  const ranked: MatchedAgent[] = agents
    .map((agent) => {
      const matchScore = scoreAgentForLead(lead, agent);
      return { ...agent, matchScore };
    })
    .filter((a) => a.matchScore >= 0)
    .sort((a, b) => b.matchScore - a.matchScore);

  return ranked.slice(0, limit);
}
