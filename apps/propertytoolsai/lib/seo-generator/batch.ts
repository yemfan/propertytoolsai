import { generateSeoPageContent } from "./content";
import { upsertSeoPage, type StaleSeoPageRow } from "./db";
import type { SeoGeneratorInput } from "./types";

export async function generateSeoPagesBatch(inputs: SeoGeneratorInput[]) {
  const results: Array<{ slug: string; success: boolean; error?: string }> = [];

  for (const input of inputs) {
    try {
      const page = await generateSeoPageContent(input);
      await upsertSeoPage(input, page);
      results.push({ slug: page.slug, success: true });
    } catch (error) {
      let msg = "Generation failed";
      if (error instanceof Error) msg = error.message;
      else if (typeof error === "string") msg = error;
      else if (error && typeof error === "object" && "message" in error && typeof (error as { message: unknown }).message === "string") {
        msg = (error as { message: string }).message;
      } else {
        try {
          msg = JSON.stringify(error);
        } catch {
          msg = String(error);
        }
      }
      results.push({
        slug: `${input.city}-${input.template}`,
        success: false,
        error: msg,
      });
    }
  }

  return results;
}

export function staleRowToInput(row: StaleSeoPageRow): SeoGeneratorInput {
  const pt = row.property_type;
  const propertyType =
    pt === "single_family" || pt === "condo" || pt === "townhome" || pt === "multi_family" ? pt : undefined;

  const base: SeoGeneratorInput = {
    city: row.city,
    state: row.state,
    zip: row.zip || undefined,
    maxPrice: row.max_price != null ? Number(row.max_price) : undefined,
    beds: row.beds != null ? Number(row.beds) : undefined,
    propertyType,
    template: row.template as SeoGeneratorInput["template"],
  };

  if (row.template === "city_money_keyword") {
    if (row.money_keyword) base.moneyKeyword = row.money_keyword;
    if (row.money_keyword_slug) base.moneyKeywordSlug = row.money_keyword_slug;
  }

  return base;
}
