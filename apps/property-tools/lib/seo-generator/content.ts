import type { SeoGeneratedPage, SeoGeneratorInput } from "./types";
import { buildSeoPageBase } from "./templates";
import { getSeoTemplateStats, getSeoTemplateFaq, getSeoInternalLinks } from "./data";

export async function generateSeoPageContent(input: SeoGeneratorInput): Promise<SeoGeneratedPage> {
  const base = buildSeoPageBase(input);
  const [stats, faq, internalLinks] = await Promise.all([
    getSeoTemplateStats(input),
    getSeoTemplateFaq(input),
    getSeoInternalLinks(input),
  ]);

  return {
    slug: base.slug,
    template: input.template,
    city: input.city,
    state: input.state,
    title: base.title,
    metaTitle: base.metaTitle,
    metaDescription: base.metaDescription,
    h1: base.h1,
    intro: base.intro,
    stats,
    faq,
    internalLinks,
    listingsQuery: {
      city: input.city,
      state: input.state,
      zip: input.zip,
      maxPrice: input.maxPrice,
      beds: input.beds,
      propertyType: input.propertyType,
    },
    calculatorCta: base.calculatorCta,
  };
}
