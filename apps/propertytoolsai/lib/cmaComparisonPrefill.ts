import type { PropertyInput } from "@/lib/propertyScoring";

/** sessionStorage payload for `/ai-property-comparison?from=cma` */
export const CMA_COMPARISON_PREFILL_KEY = "propertytools_comparison_prefill_v1";

export type CmaPrefillPayload = {
  rows: PropertyInput[];
};

type CmaLike = {
  subject: {
    address: string;
    beds: number;
    baths: number;
    sqft: number;
  };
  estimatedValue: number;
  comps: Array<{
    address: string;
    price: number;
    sqft: number;
    beds: number;
    baths: number;
  }>;
};

function newId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Primary row from CMA subject + estimated value as list price proxy */
export function buildCmaSubjectProperty(data: CmaLike): PropertyInput {
  return {
    id: newId("cma_subject"),
    address: data.subject.address,
    price: Math.max(1, Math.round(data.estimatedValue)),
    beds: data.subject.beds,
    baths: data.subject.baths,
    sqft: Math.max(1, data.subject.sqft),
    rentMonthly: null,
  };
}

/**
 * 2–3 “similar” properties: prefer real comps from CMA; pad with synthetic rows if needed.
 */
export function generateMockAiPicks(data: CmaLike): PropertyInput[] {
  const base = data.subject;
  const picks: PropertyInput[] = data.comps.slice(0, 3).map((c, i) => ({
    id: newId(`cma_ai_pick_${i}`),
    address: c.address,
    price: Math.max(1, Math.round(c.price)),
    beds: c.beds,
    baths: c.baths,
    sqft: Math.max(1, c.sqft),
    rentMonthly: null as number | null,
  }));

  let n = 1;
  while (picks.length < 2) {
    picks.push({
      id: newId("cma_ai_pick_synth"),
      address: `${base.address.split(",")[0] || base.address} — Similar listing ${n} (illustrative)`,
      price: Math.max(1, Math.round(data.estimatedValue * (0.93 + n * 0.03))),
      beds: base.beds,
      baths: base.baths,
      sqft: Math.max(400, Math.round(base.sqft * (0.97 + n * 0.015))),
      rentMonthly: null,
    });
    n += 1;
  }

  return picks.slice(0, 3);
}

export function saveComparisonPrefill(payload: CmaPrefillPayload): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(CMA_COMPARISON_PREFILL_KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

export function readAndClearComparisonPrefill(): CmaPrefillPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(CMA_COMPARISON_PREFILL_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(CMA_COMPARISON_PREFILL_KEY);
    const parsed = JSON.parse(raw) as CmaPrefillPayload;
    if (!parsed?.rows || !Array.isArray(parsed.rows) || parsed.rows.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}
