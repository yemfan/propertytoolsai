import { supabaseAdmin } from "@/lib/supabase/admin";
import { generateSeoPagesBatch } from "./batch";
import { filterNewSeoInputs } from "./dedupe";
import { buildMoneyKeywordInputs } from "./money-keywords";
import { buildExpansionInputsForCity, getDefaultExpansionCities } from "./keywords";
import { buildSeoSlug } from "./slug";
import type { SeoGeneratorInput } from "./types";

const QUEUE_TABLE = "seo_expansion_queue";

export type ExpansionQueueRow = {
  id: string;
  slug: string;
  city: string;
  state: string;
  zip: string | null;
  template: string;
  max_price: number | null;
  beds: number | null;
  property_type: string | null;
  money_keyword: string | null;
  money_keyword_slug: string | null;
  priority: number;
  status: string;
};

function expansionQueueRowToInput(row: ExpansionQueueRow): SeoGeneratorInput {
  const pt = row.property_type;
  const propertyType =
    pt === "single_family" || pt === "condo" || pt === "townhome" || pt === "multi_family" ? pt : undefined;

  const input: SeoGeneratorInput = {
    city: row.city,
    state: row.state,
    zip: row.zip || undefined,
    template: row.template as SeoGeneratorInput["template"],
    maxPrice: row.max_price != null ? Number(row.max_price) : undefined,
    beds: row.beds != null ? Number(row.beds) : undefined,
    propertyType,
  };

  if (row.template === "city_money_keyword") {
    if (row.money_keyword) input.moneyKeyword = row.money_keyword;
    if (row.money_keyword_slug) input.moneyKeywordSlug = row.money_keyword_slug;
  }

  return input;
}

export function calculateExpansionPriority(input: SeoGeneratorInput): number {
  let priority = 50;
  if (input.template === "city_money_keyword") priority += 25;
  if (input.template === "city_affordability") priority += 20;
  if (input.template === "city_price") priority += 15;
  if (input.template === "city_beds") priority += 10;
  if (input.maxPrice && input.maxPrice <= 1_000_000) priority += 10;
  if (input.beds === 3) priority += 8;
  if (input.propertyType === "single_family") priority += 6;
  return priority;
}

export async function queueSeoExpansionCandidates(inputs: SeoGeneratorInput[]) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY not set");
  }
  if (!inputs.length) return [];

  const now = new Date().toISOString();
  const rows = inputs.map((input) => ({
    slug: buildSeoSlug(input),
    city: input.city,
    state: input.state,
    zip: input.zip ?? null,
    template: input.template,
    max_price: input.maxPrice ?? null,
    beds: input.beds ?? null,
    property_type: input.propertyType ?? null,
    money_keyword: input.moneyKeyword ?? null,
    money_keyword_slug: input.moneyKeywordSlug ?? null,
    priority: calculateExpansionPriority(input),
    status: "pending",
    source: "auto_expand",
    updated_at: now,
  }));

  const { data, error } = await supabaseAdmin.from(QUEUE_TABLE).upsert(rows, { onConflict: "slug" }).select();

  if (error) throw error;
  return data ?? [];
}

export async function autoQueueDailyExpansion() {
  const cities = getDefaultExpansionCities();
  const baseInputs = cities.flatMap(buildExpansionInputsForCity);
  const moneyInputs = cities.flatMap((c) => buildMoneyKeywordInputs(c.city, c.state));
  const allInputs = [...baseInputs, ...moneyInputs];
  const freshInputs = await filterNewSeoInputs(allInputs);
  if (!freshInputs.length) return [];
  return queueSeoExpansionCandidates(freshInputs);
}

export async function pullPendingExpansionBatch(limit = 50): Promise<ExpansionQueueRow[]> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) return [];

  const { data, error } = await supabaseAdmin
    .from(QUEUE_TABLE)
    .select("*")
    .eq("status", "pending")
    .order("priority", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    console.warn("[seo_expansion_queue] pullPendingExpansionBatch:", error.message);
    return [];
  }

  return (data ?? []) as ExpansionQueueRow[];
}

export async function runExpansionBatch(limit = 50) {
  const rows = await pullPendingExpansionBatch(limit);
  if (!rows.length) {
    return { generated: 0, results: [] as Array<{ slug: string; success: boolean; error?: string }> };
  }

  const inputs: SeoGeneratorInput[] = rows.map(expansionQueueRowToInput);
  const results = await generateSeoPagesBatch(inputs);

  const now = new Date().toISOString();
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const result = results[i];
    await supabaseAdmin
      .from(QUEUE_TABLE)
      .update({
        status: result?.success ? "generated" : "failed",
        generated_at: result?.success ? now : null,
        updated_at: now,
      })
      .eq("id", row.id);
  }

  return {
    generated: results.filter((r) => r.success).length,
    results,
  };
}
