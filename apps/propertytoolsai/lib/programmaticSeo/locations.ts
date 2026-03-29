import type { ProgrammaticSeoLocation } from "./types";
import { TRAFFIC_CITIES } from "@/lib/trafficSeo";

const fromTraffic: ProgrammaticSeoLocation[] = TRAFFIC_CITIES.map((c) => ({
  slug: c.slug,
  city: c.city,
  state: c.state,
}));

/** Additional metros to reach 1,000+ tool × city combinations */
const EXTRA: ProgrammaticSeoLocation[] = [
  { slug: "sacramento-ca", city: "Sacramento", state: "CA" },
  { slug: "san-jose-ca", city: "San Jose", state: "CA" },
  { slug: "riverside-ca", city: "Riverside", state: "CA" },
  { slug: "fresno-ca", city: "Fresno", state: "CA" },
  { slug: "long-beach-ca", city: "Long Beach", state: "CA" },
  { slug: "oakland-ca", city: "Oakland", state: "CA" },
  { slug: "anaheim-ca", city: "Anaheim", state: "CA" },
  { slug: "santa-ana-ca", city: "Santa Ana", state: "CA" },
  { slug: "stockton-ca", city: "Stockton", state: "CA" },
  { slug: "irvine-ca", city: "Irvine", state: "CA" },
  { slug: "bakersfield-ca", city: "Bakersfield", state: "CA" },
  { slug: "portland-or", city: "Portland", state: "OR" },
  { slug: "tucson-az", city: "Tucson", state: "AZ" },
  { slug: "mesa-az", city: "Mesa", state: "AZ" },
  { slug: "albuquerque-nm", city: "Albuquerque", state: "NM" },
  { slug: "kansas-city-mo", city: "Kansas City", state: "MO" },
  { slug: "st-louis-mo", city: "St. Louis", state: "MO" },
  { slug: "pittsburgh-pa", city: "Pittsburgh", state: "PA" },
  { slug: "cincinnati-oh", city: "Cincinnati", state: "OH" },
  { slug: "cleveland-oh", city: "Cleveland", state: "OH" },
  { slug: "indianapolis-in", city: "Indianapolis", state: "IN" },
  { slug: "columbus-oh", city: "Columbus", state: "OH" },
  { slug: "detroit-mi", city: "Detroit", state: "MI" },
  { slug: "milwaukee-wi", city: "Milwaukee", state: "WI" },
  { slug: "baltimore-md", city: "Baltimore", state: "MD" },
  { slug: "virginia-beach-va", city: "Virginia Beach", state: "VA" },
  { slug: "raleigh-nc", city: "Raleigh", state: "NC" },
  { slug: "oklahoma-city-ok", city: "Oklahoma City", state: "OK" },
  { slug: "tulsa-ok", city: "Tulsa", state: "OK" },
  { slug: "new-orleans-la", city: "New Orleans", state: "LA" },
  { slug: "wichita-ks", city: "Wichita", state: "KS" },
  { slug: "arlington-tx", city: "Arlington", state: "TX" },
  { slug: "aurora-co", city: "Aurora", state: "CO" },
  { slug: "boise-id", city: "Boise", state: "ID" },
  { slug: "spokane-wa", city: "Spokane", state: "WA" },
  { slug: "honolulu-hi", city: "Honolulu", state: "HI" },
  { slug: "salt-lake-city-ut", city: "Salt Lake City", state: "UT" },
  { slug: "birmingham-al", city: "Birmingham", state: "AL" },
  { slug: "richmond-va", city: "Richmond", state: "VA" },
];

function dedupeBySlug(locations: ProgrammaticSeoLocation[]): ProgrammaticSeoLocation[] {
  const map = new Map<string, ProgrammaticSeoLocation>();
  for (const l of locations) {
    if (!map.has(l.slug)) map.set(l.slug, l);
  }
  return Array.from(map.values());
}

/** All locations used for `/tool/[toolSlug]/[locationSlug]` */
export const PROGRAMMATIC_SEO_LOCATIONS: ProgrammaticSeoLocation[] = dedupeBySlug([...fromTraffic, ...EXTRA]);

export function getProgrammaticLocationBySlug(slug: string): ProgrammaticSeoLocation | undefined {
  return PROGRAMMATIC_SEO_LOCATIONS.find((l) => l.slug === slug);
}

export function countProgrammaticSeoCombinations(toolCount = 0, locationCount = PROGRAMMATIC_SEO_LOCATIONS.length) {
  const n = toolCount > 0 ? toolCount : 0;
  return n * locationCount;
}
