import { buildMoneySlug, MONEY_KEYWORD_BY_SLUG, MONEY_KEYWORD_SLUGS } from "./money-keywords";
import type { SeoGeneratorInput, SeoPageTemplate } from "./types";

export function clean(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function buildSeoSlug(input: SeoGeneratorInput): string {
  const city = clean(input.city);

  switch (input.template) {
    case "city_price":
      return `homes-under-${Math.round((input.maxPrice || 0) / 1000)}k-in-${city}`;
    case "city_beds":
      return `${input.beds || 0}-bedroom-homes-in-${city}`;
    case "city_affordability":
      return `${city}-affordability`;
    case "city_investment":
      return `best-investment-properties-in-${city}`;
    case "city_property_type":
      return `${city}-${clean(input.propertyType || "homes")}`;
    case "city_money_keyword": {
      const kw = input.moneyKeywordSlug?.trim() || clean(input.moneyKeyword || "homes");
      return buildMoneySlug(input.city, kw);
    }
    default:
      return city;
  }
}

const PROPERTY_TYPE_SUFFIXES = [
  "single_family",
  "condo",
  "townhome",
  "multi_family",
  "homes",
] as const;

function titleCaseCityFromSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Reverse URL slug → generator input (default state CA).
 * Returns null if the slug does not match a known pattern.
 */
export function parseSeoSlugToInput(slug: string, defaultState = "CA"): SeoGeneratorInput | null {
  const s = slug.trim().toLowerCase();
  if (!s) return null;

  let m: RegExpExecArray | null;

  m = /^homes-under-(\d+)k-in-(.+)$/.exec(s);
  if (m) {
    const thousands = Number(m[1]);
    const citySlug = m[2];
    if (!Number.isFinite(thousands) || !citySlug) return null;
    return {
      city: titleCaseCityFromSlug(citySlug),
      state: defaultState,
      maxPrice: thousands * 1000,
      template: "city_price",
    };
  }

  m = /^(\d+)-bedroom-homes-in-(.+)$/.exec(s);
  if (m) {
    const beds = Number(m[1]);
    const citySlug = m[2];
    if (!Number.isFinite(beds) || !citySlug) return null;
    return {
      city: titleCaseCityFromSlug(citySlug),
      state: defaultState,
      beds,
      template: "city_beds",
    };
  }

  if (s.endsWith("-affordability")) {
    const citySlug = s.slice(0, -"-affordability".length);
    if (!citySlug) return null;
    return {
      city: titleCaseCityFromSlug(citySlug),
      state: defaultState,
      template: "city_affordability",
    };
  }

  m = /^best-investment-properties-in-(.+)$/.exec(s);
  if (m && m[1]) {
    return {
      city: titleCaseCityFromSlug(m[1]),
      state: defaultState,
      template: "city_investment",
    };
  }

  for (const phrase of MONEY_KEYWORD_SLUGS) {
    const prefix = `${phrase}-in-`;
    if (s.startsWith(prefix)) {
      const citySlug = s.slice(prefix.length);
      if (!citySlug) continue;
      const label = MONEY_KEYWORD_BY_SLUG[phrase];
      if (!label) continue;
      return {
        city: titleCaseCityFromSlug(citySlug),
        state: defaultState,
        template: "city_money_keyword",
        moneyKeyword: label,
        moneyKeywordSlug: phrase,
      };
    }
  }

  for (const suffix of PROPERTY_TYPE_SUFFIXES) {
    const suffixWithDash = `-${suffix}`;
    if (s.endsWith(suffixWithDash)) {
      const citySlug = s.slice(0, -suffixWithDash.length);
      if (!citySlug) continue;
      const pt = suffix as SeoGeneratorInput["propertyType"] | "homes";
      return {
        city: titleCaseCityFromSlug(citySlug),
        state: defaultState,
        propertyType: suffix === "homes" ? undefined : (suffix as SeoGeneratorInput["propertyType"]),
        template: "city_property_type",
      };
    }
  }

  return null;
}
