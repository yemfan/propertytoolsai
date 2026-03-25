import type { PropertySeoRecord } from "./types";

function money(value?: number) {
  if (typeof value !== "number") return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function indefiniteArticle(word: string) {
  const w = word.trim();
  if (!w) return "a";
  return /^[aeiou]/i.test(w) ? "an" : "a";
}

export function buildPropertySeoDescription(record: PropertySeoRecord) {
  const facts = [
    record.beds ? `${record.beds} bedrooms` : null,
    record.baths ? `${record.baths} bathrooms` : null,
    record.sqft ? `${record.sqft.toLocaleString()} sqft` : null,
  ].filter(Boolean);

  const typeLabel = record.propertyType?.replaceAll("_", " ") || "home";
  const article = indefiniteArticle(typeLabel);
  const factClause = facts.length ? ` with ${facts.join(", ")}` : "";
  return `${record.fullAddress} is ${article} ${typeLabel} in ${record.city}, ${record.state}${factClause}. Estimated home value ${money(record.estimateValue)}.`;
}

export function buildPropertyFaq(record: PropertySeoRecord) {
  return [
    {
      question: `What is the estimated value of ${record.fullAddress}?`,
      answer: `The current estimated value is around ${money(record.estimateValue)}, with an estimated range of ${money(record.estimateRangeLow)} to ${money(record.estimateRangeHigh)}.`,
    },
    {
      question: `How much would the monthly payment be for ${record.fullAddress}?`,
      answer: record.affordabilityExample
        ? `A sample payment scenario for a home around ${money(record.affordabilityExample.purchasePrice)} is about ${money(record.affordabilityExample.estimatedMonthlyPayment)} per month, depending on rate, down payment, taxes, and insurance.`
        : `Monthly payment depends on rate, down payment, taxes, insurance, and loan type.`,
    },
    {
      question: `Are there similar homes near ${record.fullAddress}?`,
      answer: `Yes. This page includes nearby comparable sales and current nearby listings to help you compare value and options in ${record.city}.`,
    },
  ];
}
