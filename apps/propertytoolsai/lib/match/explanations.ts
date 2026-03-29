import type { BuyerPreferences, PropertyMatch } from "./types";

export function buildMatchExplanation(prefs: BuyerPreferences, match: PropertyMatch): string {
  const parts: string[] = [];

  if (typeof prefs.budget === "number") {
    if (match.price <= prefs.budget) {
      parts.push("it fits within your stated budget");
    } else if (match.price <= prefs.budget * 1.05) {
      parts.push("it is very close to your budget range");
    }
  }

  if (prefs.city) {
    parts.push(`it is located in ${prefs.city}`);
  }

  if (prefs.beds && (match.beds ?? 0) >= prefs.beds) {
    parts.push("it meets your bedroom needs");
  }

  if (prefs.baths && (match.baths ?? 0) >= prefs.baths) {
    parts.push("it matches your bathroom requirements");
  }

  if (prefs.lifestyle === "investment") {
    parts.push("it may work well as an investment-style opportunity");
  } else if (prefs.lifestyle === "family") {
    parts.push("it looks like a practical fit for a family-oriented search");
  } else if (prefs.lifestyle === "luxury") {
    parts.push("it aligns with a higher-end home search profile");
  } else if (prefs.lifestyle === "commute") {
    parts.push("it fits a commute-focused, urban-style search");
  }

  if (!parts.length) {
    return "This home matches several of the preferences you entered and scored well overall against your search criteria.";
  }

  return `This home stands out because ${parts.join(", ")}.`;
}
