import { NextResponse } from "next/server";

import { getIdxAdapter, isIdxFailure } from "@/lib/idx";
import type { IdxPropertyType, IdxSearchFilters } from "@/lib/idx/types";

const VALID_PROPERTY_TYPES: IdxPropertyType[] = [
  "single_family",
  "condo",
  "townhouse",
  "multi_family",
  "land",
  "other",
];

function readNumberParam(value: string | null): number | undefined {
  if (!value) return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

function readStringParam(value: string | null): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function readPropertyTypeParam(value: string | null): IdxPropertyType | undefined {
  if (!value) return undefined;
  return VALID_PROPERTY_TYPES.includes(value as IdxPropertyType) ? (value as IdxPropertyType) : undefined;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sp = url.searchParams;

  const filters: IdxSearchFilters = {
    city: readStringParam(sp.get("city")),
    state: readStringParam(sp.get("state")),
    zip: readStringParam(sp.get("zip")),
    priceMin: readNumberParam(sp.get("priceMin")),
    priceMax: readNumberParam(sp.get("priceMax")),
    bedsMin: readNumberParam(sp.get("bedsMin")),
    bathsMin: readNumberParam(sp.get("bathsMin")),
    sqftMin: readNumberParam(sp.get("sqftMin")),
    propertyType: readPropertyTypeParam(sp.get("propertyType")),
    page: readNumberParam(sp.get("page")) ?? 1,
    pageSize: readNumberParam(sp.get("pageSize")) ?? 25,
  };

  const adapter = getIdxAdapter();
  const result = await adapter.searchListings(filters);
  if (isIdxFailure(result)) {
    const status =
      result.error.kind === "unauthorized"
        ? 503
        : result.error.kind === "rate_limited"
          ? 429
          : result.error.kind === "not_configured"
            ? 503
            : 502;
    return NextResponse.json(
      { ok: false, error: result.error.kind, provider: adapter.providerId },
      { status },
    );
  }

  return NextResponse.json({
    ok: true,
    provider: adapter.providerId,
    ...result.data,
  });
}
