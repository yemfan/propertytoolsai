import type { SeoGeneratorInput } from "./types";

function cleanSegment(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Slug segment (before `-in-{city}`) → human-readable phrase for titles/copy. */
export const MONEY_KEYWORD_BY_SLUG: Record<string, string> = {
  "good-schools": "homes near good schools",
  "investment-properties": "investment properties",
  "first-time-buyers": "first-time buyer homes",
  "affordable-homes": "affordable homes",
  "luxury-homes": "luxury homes",
};

export const MONEY_KEYWORD_SLUGS = Object.keys(MONEY_KEYWORD_BY_SLUG);

export function buildMoneySlug(city: string, keywordSlug: string): string {
  return `${cleanSegment(keywordSlug)}-in-${cleanSegment(city)}`;
}

export function buildMoneyContent(city: string, keywordLabel: string) {
  const titled = keywordLabel.charAt(0).toUpperCase() + keywordLabel.slice(1);
  return {
    title: `${titled} in ${city}`,
    h1: `${titled} in ${city}`,
    intro: `Looking for ${keywordLabel} in ${city}? Explore listings, compare prices, and find opportunities that match your goals.`,
  };
}

/**
 * High-intent buyer queries as separate URLs: `{slugPhrase}-in-{city}`.
 */
export function buildMoneyKeywordInputs(city: string, state: string): SeoGeneratorInput[] {
  const inputs: SeoGeneratorInput[] = [];

  for (const slugPhrase of MONEY_KEYWORD_SLUGS) {
    const label = MONEY_KEYWORD_BY_SLUG[slugPhrase];
    inputs.push({
      city,
      state,
      template: "city_money_keyword",
      moneyKeyword: label,
      moneyKeywordSlug: slugPhrase,
    });
  }

  return inputs;
}
