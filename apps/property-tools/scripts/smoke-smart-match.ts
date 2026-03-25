/**
 * Unit-style smoke for lib/match + POST /api/match handler (no dev server).
 */
import { POST } from "../app/api/match/route";
import { calculateMatchScore } from "../lib/match/engine";
import type { BuyerPreferences, MatchableListing } from "../lib/match/types";

const prefs: BuyerPreferences = {
  budget: 800_000,
  city: "Pasadena",
  state: "CA",
  beds: 3,
  baths: 2,
  lifestyle: "family",
  timeline: "asap",
};

const listing: MatchableListing = {
  id: "t1",
  address: "123 Main St",
  city: "Pasadena",
  state: "CA",
  price: 795_000,
  beds: 3,
  baths: 2,
  sqft: 1600,
  daysOnMarket: 7,
  propertyType: "single_family",
};

const m = calculateMatchScore(prefs, listing);
if (m.matchScore < 1 || m.matchScore > 100) {
  throw new Error(`score out of range: ${m.matchScore}`);
}
if (!m.matchReasons.length) {
  throw new Error("expected at least one reason");
}
if (m.id !== "t1") throw new Error("id mismatch");

const req = new Request("http://test.local/api/match", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ budget: 800000, city: "Pasadena", state: "CA", beds: 3, baths: 2 }),
});
const res = await POST(req);
const api = (await res.json()) as {
  success?: boolean;
  matches?: { id: string }[];
  provider?: string;
};
if (!res.ok || !api.success || !api.matches?.length) {
  throw new Error(`POST /api/match failed: ${res.status} ${JSON.stringify(api)}`);
}

console.log("smoke-smart-match: OK", {
  engineScore: m.matchScore,
  apiMatches: api.matches.length,
  provider: api.provider,
});
