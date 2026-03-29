import { buildMoneyContent } from "./money-keywords";
import type { SeoGeneratorInput } from "./types";
import { buildSeoSlug } from "./slug";

export type SeoPageBase = {
  slug: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  h1: string;
  intro: string;
  calculatorCta: {
    label: string;
    href: string;
    description: string;
  };
};

function money(value?: number) {
  if (typeof value !== "number") return "";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function buildSeoPageBase(input: SeoGeneratorInput): SeoPageBase {
  const slug = buildSeoSlug(input);
  const city = input.city;
  const state = input.state;

  switch (input.template) {
    case "city_price": {
      const maxPrice = input.maxPrice || 800000;
      return {
        slug,
        title: `Homes under ${money(maxPrice)} in ${city}, ${state}`,
        metaTitle: `Homes under ${money(maxPrice)} in ${city} | PropertyToolsAI`,
        metaDescription: `Browse homes under ${money(maxPrice)} in ${city}, ${state}. See live listings, affordability insights, and AI-powered home matches.`,
        h1: `Homes under ${money(maxPrice)} in ${city}`,
        intro: `Explore homes under ${money(maxPrice)} in ${city}, ${state}. Compare listings, estimate monthly payments, and find better-fit homes with Smart Match.`,
        calculatorCta: {
          label: `Check what you can afford in ${city}`,
          href: "/affordability",
          description: `Use our affordability report to see whether homes in ${city} fit your budget.`,
        },
      };
    }

    case "city_beds": {
      const beds = input.beds || 3;
      return {
        slug,
        title: `${beds}-bedroom homes in ${city}, ${state}`,
        metaTitle: `${beds}-bedroom homes in ${city} | PropertyToolsAI`,
        metaDescription: `Browse ${beds}-bedroom homes in ${city}, ${state}. Compare prices, affordability, and AI-ranked matches.`,
        h1: `${beds}-bedroom homes in ${city}`,
        intro: `Looking for ${beds}-bedroom homes in ${city}? Explore available listings, compare value, and get matched to homes that fit your lifestyle and budget.`,
        calculatorCta: {
          label: `Find your best-fit home in ${city}`,
          href: "/match",
          description: `Tell us your budget and needs, and Smart Match will rank homes for you.`,
        },
      };
    }

    case "city_affordability": {
      return {
        slug,
        title: `Can you afford a home in ${city}, ${state}?`,
        metaTitle: `${city} affordability guide | PropertyToolsAI`,
        metaDescription: `See if you can afford a home in ${city}, ${state}. Estimate buying power, monthly payments, and homes in your budget.`,
        h1: `Can you afford a home in ${city}?`,
        intro: `Use local pricing and affordability assumptions to understand what budget may be realistic in ${city}, ${state}.`,
        calculatorCta: {
          label: `Run affordability report`,
          href: "/affordability",
          description: `Estimate your buying power and compare homes you may be able to afford.`,
        },
      };
    }

    case "city_investment": {
      return {
        slug,
        title: `Best investment properties in ${city}, ${state}`,
        metaTitle: `Best investment properties in ${city} | PropertyToolsAI`,
        metaDescription: `Explore homes and investment opportunities in ${city}, ${state}. Review listings, pricing, and property trends.`,
        h1: `Best investment properties in ${city}`,
        intro: `Explore homes in ${city}, ${state} that may be worth a closer look for investors, landlords, or long-term buyers.`,
        calculatorCta: {
          label: `Find investor-friendly homes`,
          href: "/match",
          description: `Use Smart Match to surface homes that better fit an investment strategy.`,
        },
      };
    }

    case "city_property_type": {
      const propertyType = (input.propertyType || "homes").replaceAll("_", " ");
      return {
        slug,
        title: `${city} ${propertyType}`,
        metaTitle: `${city} ${propertyType} | PropertyToolsAI`,
        metaDescription: `Browse ${propertyType} in ${city}, ${state}. Compare listings, value, and affordability in one place.`,
        h1: `${propertyType} in ${city}`,
        intro: `Explore ${propertyType} in ${city}, ${state}, compare prices, and see which homes fit your budget and goals.`,
        calculatorCta: {
          label: `Match me with homes like this`,
          href: "/match",
          description: `Use Smart Match to rank the best properties based on your preferences.`,
        },
      };
    }

    case "city_money_keyword": {
      const phrase = input.moneyKeyword || "homes";
      const { title, h1, intro } = buildMoneyContent(city, phrase);
      return {
        slug,
        title: `${title}, ${state}`,
        metaTitle: `${h1} | PropertyToolsAI`,
        metaDescription: `Find ${phrase} in ${city}, ${state}. Browse listings, compare value, and get AI-ranked Smart Match results.`,
        h1,
        intro: `${intro} See what is on the market and what fits your budget in ${state}.`,
        calculatorCta: {
          label: `Get matched in ${city}`,
          href: "/match",
          description: `Tell us your goals and budget—Smart Match ranks the best homes for you.`,
        },
      };
    }

    default: {
      return {
        slug,
        title: `${city}, ${state}`,
        metaTitle: `${city} real estate | PropertyToolsAI`,
        metaDescription: `Explore homes and tools in ${city}, ${state}.`,
        h1: `Homes in ${city}`,
        intro: `Browse listings and tools for ${city}, ${state}.`,
        calculatorCta: {
          label: `Smart Match`,
          href: "/match",
          description: `Find homes that fit your budget and lifestyle.`,
        },
      };
    }
  }
}
