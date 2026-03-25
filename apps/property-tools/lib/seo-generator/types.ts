export type SeoPageTemplate =
  | "city_price"
  | "city_beds"
  | "city_affordability"
  | "city_investment"
  | "city_property_type"
  | "city_money_keyword";

export type SeoGeneratorInput = {
  city: string;
  state: string;
  zip?: string;
  maxPrice?: number;
  beds?: number;
  propertyType?: "single_family" | "condo" | "townhome" | "multi_family";
  /** Human phrase for `city_money_keyword` (e.g. "luxury homes"). */
  moneyKeyword?: string;
  /** URL segment for `city_money_keyword` (e.g. "luxury-homes"); falls back to slugified `moneyKeyword`. */
  moneyKeywordSlug?: string;
  template: SeoPageTemplate;
};

export type SeoGeneratedPage = {
  slug: string;
  template: SeoPageTemplate;
  city: string;
  state: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  h1: string;
  intro: string;
  stats: Array<{ label: string; value: string }>;
  faq: Array<{ question: string; answer: string }>;
  internalLinks: Array<{ label: string; href: string }>;
  listingsQuery: {
    city: string;
    state: string;
    zip?: string;
    maxPrice?: number;
    beds?: number;
    propertyType?: string;
  };
  calculatorCta: {
    label: string;
    href: string;
    description: string;
  };
};
