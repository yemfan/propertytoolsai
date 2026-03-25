import type { SeoGeneratorInput } from "./types";
import { clean } from "./slug";

function money(value?: number) {
  if (typeof value !== "number") return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export async function getSeoTemplateStats(input: SeoGeneratorInput) {
  if (input.template === "city_affordability") {
    return [
      { label: "Median home price", value: money(820000) },
      { label: "Estimated monthly payment", value: money(5300) },
      { label: "Target income", value: `${money(212000)}/yr` },
      { label: "Avg rent", value: money(3200) },
    ];
  }

  return [
    { label: "Median home price", value: money(820000) },
    { label: "Homes available", value: "24" },
    { label: "Median price / sqft", value: `${money(540)}/sqft` },
    { label: "Avg days on market", value: "28" },
  ];
}

export async function getSeoTemplateFaq(input: SeoGeneratorInput) {
  const city = input.city;
  const focus =
    input.template === "city_money_keyword" && input.moneyKeyword
      ? input.moneyKeyword
      : "homes in this area";

  return [
    {
      question: `Are there good options for ${focus} in ${city} right now?`,
      answer: `Yes. This page highlights current listings in ${city} so you can compare real inventory and pricing patterns.`,
    },
    {
      question: `Can I afford a home in ${city}?`,
      answer: `That depends on your income, debts, down payment, and financing. Use our affordability report to estimate what budget may be realistic.`,
    },
    {
      question: `How do I find better-fit homes in ${city}?`,
      answer: `Use Smart Match to rank homes based on your budget, preferred area, and key home requirements.`,
    },
  ];
}

export async function getSeoInternalLinks(input: SeoGeneratorInput) {
  const citySlug = clean(input.city);

  return [
    {
      label: `${input.city} affordability`,
      href: `/${citySlug}-affordability`,
    },
    {
      label: `Homes for sale in ${input.city}`,
      href: `/search?city=${encodeURIComponent(input.city)}&state=${encodeURIComponent(input.state)}`,
    },
    {
      label: `Find homes with Smart Match`,
      href: "/match",
    },
  ];
}
