import "server-only";

import type { CmaSnapshot, CmaCompRow } from "./types";

/**
 * HTTP client for the propertytoolsai `/api/smart-cma` endpoint.
 *
 * The valuation engine + comp pipeline live in propertytoolsai (its
 * lib/valuation, lib/propertyService, comps-ingestion). The leadsmartai
 * CRM doesn't reimplement any of that — it just calls the upstream
 * endpoint and stores the resulting snapshot.
 *
 * Configurable via `PROPERTYTOOLS_INTERNAL_URL`:
 *   - dev:  http://localhost:3001  (the propertytoolsai port)
 *   - prod: https://propertytoolsai.com
 *
 * When unset, falls back to a sensible production default. We don't
 * throw on missing env in dev so a fresh checkout can still load CMAs
 * from the deployed propertytoolsai instance.
 */

const DEFAULT_PROPERTYTOOLS_URL = "https://propertytoolsai.com";

export type FetchSmartCmaInput = {
  address: string;
  /** When set, the upstream attaches lead-scoring events. Optional. */
  leadId?: string | null;
  /** Override property characteristics when the caller has better data
   *  than the warehouse (e.g. agent corrects sqft after walk-through). */
  beds?: number;
  baths?: number;
  sqft?: number;
  yearBuilt?: number;
  condition?: string;
};

export type FetchSmartCmaResult =
  | { ok: true; snapshot: CmaSnapshot }
  | { ok: false; status: number; error: string };

/**
 * Narrowing predicate — TypeScript with `strict: false` doesn't narrow
 * a discriminated union on `!result.ok`, so callers need this to access
 * `.status` / `.error` after a failure check.
 */
export function isSmartCmaFailure(
  r: FetchSmartCmaResult,
): r is { ok: false; status: number; error: string } {
  return r.ok === false;
}

export async function fetchSmartCma(
  input: FetchSmartCmaInput,
): Promise<FetchSmartCmaResult> {
  const baseUrl = (process.env.PROPERTYTOOLS_INTERNAL_URL ?? DEFAULT_PROPERTYTOOLS_URL).replace(
    /\/+$/,
    "",
  );
  const url = `${baseUrl}/api/smart-cma`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        address: input.address,
        lead_id: input.leadId ?? undefined,
        beds: input.beds,
        baths: input.baths,
        sqft: input.sqft,
        yearBuilt: input.yearBuilt,
        condition: input.condition,
      }),
      cache: "no-store",
    });
  } catch (e) {
    return {
      ok: false,
      status: 0,
      error: `Network error contacting smart-cma: ${
        e instanceof Error ? e.message : "unknown"
      }`,
    };
  }

  if (!res.ok) {
    let errorMessage = `smart-cma returned ${res.status}`;
    try {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      if (body?.error) errorMessage = body.error;
    } catch {
      // Non-fatal — we already have the status.
    }
    return { ok: false, status: res.status, error: errorMessage };
  }

  const raw = (await res.json().catch(() => null)) as RawSmartCmaResponse | null;
  if (!raw) {
    return { ok: false, status: res.status, error: "Empty smart-cma response body" };
  }

  return { ok: true, snapshot: normalizeRaw(raw) };
}

// ── Internal: shape the upstream returns ─────────────────────────

type RawSmartCmaResponse = {
  ok?: boolean;
  subject?: {
    address?: unknown;
    beds?: unknown;
    baths?: unknown;
    sqft?: unknown;
    propertyType?: unknown;
    yearBuilt?: unknown;
    condition?: unknown;
  };
  comps?: unknown[];
  avgPricePerSqft?: unknown;
  estimatedValue?: unknown;
  low?: unknown;
  high?: unknown;
  strategies?: {
    aggressive?: unknown;
    market?: unknown;
    premium?: unknown;
    daysOnMarket?: {
      aggressive?: unknown;
      market?: unknown;
      premium?: unknown;
    };
  };
  summary?: unknown;
};

function normalizeRaw(raw: RawSmartCmaResponse): CmaSnapshot {
  const subject = raw.subject ?? {};
  const comps = Array.isArray(raw.comps) ? raw.comps : [];

  return {
    subject: {
      address: stringOr(subject.address, ""),
      beds: numberOr(subject.beds, 0),
      baths: numberOr(subject.baths, 0),
      sqft: numberOr(subject.sqft, 0),
      propertyType: subject.propertyType == null ? null : String(subject.propertyType),
      yearBuilt: numberOr(subject.yearBuilt, 0),
      condition: subject.condition == null ? null : String(subject.condition),
    },
    comps: comps
      .map<CmaCompRow | null>((c) => {
        if (!c || typeof c !== "object") return null;
        const o = c as Record<string, unknown>;
        return {
          address: stringOr(o.address, ""),
          price: numberOr(o.price, 0),
          sqft: numberOr(o.sqft, 0),
          beds: o.beds == null ? null : numberOr(o.beds, 0),
          baths: o.baths == null ? null : numberOr(o.baths, 0),
          distanceMiles: numberOr(o.distanceMiles, 0),
          soldDate: stringOr(o.soldDate, ""),
          propertyType: o.propertyType == null ? null : String(o.propertyType),
          pricePerSqft: numberOr(o.pricePerSqft, 0),
        };
      })
      .filter((x): x is CmaCompRow => x !== null),
    valuation: {
      estimatedValue: numberOr(raw.estimatedValue, 0),
      low: numberOr(raw.low, 0),
      high: numberOr(raw.high, 0),
      avgPricePerSqft: numberOr(raw.avgPricePerSqft, 0),
    },
    strategies: raw.strategies
      ? {
          aggressive: numberOr(raw.strategies.aggressive, 0),
          market: numberOr(raw.strategies.market, 0),
          premium: numberOr(raw.strategies.premium, 0),
          daysOnMarket: {
            aggressive: numberOr(raw.strategies.daysOnMarket?.aggressive, 0),
            market: numberOr(raw.strategies.daysOnMarket?.market, 0),
            premium: numberOr(raw.strategies.daysOnMarket?.premium, 0),
          },
        }
      : null,
    summary: raw.summary == null ? null : String(raw.summary),
  };
}

function numberOr(v: unknown, fallback: number): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

function stringOr(v: unknown, fallback: string): string {
  return typeof v === "string" ? v : fallback;
}
