/**
 * Loads incorporated + CDP place names from `scripts/data/*.json`.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export type SocalPlace = {
  city: string;
  countyLabel: string;
  placeKind: "incorporated" | "cdp";
};

function countyLabelFromJsonKey(key: string): string {
  if (key.endsWith(" CDPs")) return key.slice(0, -" CDPs".length);
  return key;
}

function placeKindFromJsonKey(key: string): "incorporated" | "cdp" {
  return key.endsWith(" CDPs") ? "cdp" : "incorporated";
}

/**
 * Reads `socal-county-cities.json` and optional `socal-county-cdps.json`, merges unique `city|CA` keys.
 */
export function loadSocalCountyPlaces(): Map<string, SocalPlace> {
  const base = join(__dirname, "..", "data");
  const main = JSON.parse(readFileSync(join(base, "socal-county-cities.json"), "utf8")) as Record<string, unknown>;
  let cdps: Record<string, unknown> = {};
  try {
    cdps = JSON.parse(readFileSync(join(base, "socal-county-cdps.json"), "utf8")) as Record<string, unknown>;
  } catch {
    /* optional */
  }

  const merged = { ...main, ...cdps };
  const out = new Map<string, SocalPlace>();

  for (const [key, val] of Object.entries(merged)) {
    if (key === "note" || !Array.isArray(val)) continue;
    const countyLabel = countyLabelFromJsonKey(key);
    const placeKind = placeKindFromJsonKey(key);
    for (const raw of val) {
      const city = String(raw).trim();
      if (!city) continue;
      const k = `${city}|CA`;
      if (out.has(k)) continue;
      out.set(k, { city, countyLabel, placeKind });
    }
  }

  return out;
}
