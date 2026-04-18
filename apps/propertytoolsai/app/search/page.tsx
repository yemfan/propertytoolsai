"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { HomesInBudgetResults } from "@/components/search/HomesInBudgetResults";
import { SaveThisSearchButton } from "@/components/search/SaveThisSearchButton";
import type { ListingResult } from "@/lib/listings/adapters/types";
import type { SavedSearchCriteria } from "@/lib/contacts/types";

type SearchCriteria = {
  maxPrice: number;
  minPrice: number;
  zip: string;
  city: string;
  state: string;
  propertyType: string;
  beds: number;
  baths: number;
  limit: number;
};

function SearchPageInner() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [homes, setHomes] = useState<ListingResult[]>([]);
  const [criteria, setCriteria] = useState<SearchCriteria | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const maxPrice = searchParams.get("maxPrice") || "";
    const minPrice = searchParams.get("minPrice") || "";
    const zip = searchParams.get("zip") || "";
    const city = searchParams.get("city") || "";
    const state = searchParams.get("state") || "CA";
    const propertyType = searchParams.get("propertyType") || "";
    const beds = searchParams.get("beds") || "";
    const baths = searchParams.get("baths") || "";

    let cancelled = false;
    void (async () => {
      try {
        setLoading(true);
        setError("");
        const res = await fetch(
          `/api/search/homes-in-budget?maxPrice=${encodeURIComponent(maxPrice)}&minPrice=${encodeURIComponent(minPrice)}&zip=${encodeURIComponent(zip)}&city=${encodeURIComponent(city)}&state=${encodeURIComponent(state)}&propertyType=${encodeURIComponent(propertyType)}&beds=${encodeURIComponent(beds)}&baths=${encodeURIComponent(baths)}`,
          { cache: "no-store" }
        );
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok || !json?.success) throw new Error(json?.error || "Failed to load homes");
        setHomes(json.results ?? []);
        setCriteria(json.criteria ?? null);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load homes");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl border bg-white p-8 shadow-sm md:p-10">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-4xl font-semibold tracking-tight text-gray-900">Homes in Your Budget</h1>
              <p className="mt-3 text-sm text-gray-600 md:text-base">
                {criteria?.maxPrice
                  ? `Showing homes up to $${Number(criteria.maxPrice).toLocaleString()}`
                  : "Showing homes"}
                {criteria?.zip ? ` near ${criteria.zip}` : criteria?.city ? ` near ${criteria.city}` : ""}
                .
              </p>
            </div>
            {criteria && (
              <SaveThisSearchButton
                criteria={criteriaToSavedSearchCriteria(criteria)}
              />
            )}
          </div>
        </section>

        {loading ? (
          <div className="rounded-3xl border bg-white p-6 text-sm text-gray-500 shadow-sm">
            Loading homes...
          </div>
        ) : error ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
            {error}
          </div>
        ) : (
          <HomesInBudgetResults homes={homes} />
        )}
      </div>
    </div>
  );
}

/**
 * Translate the page's URL-param SearchCriteria into the shape the
 * saved-searches service expects. Drops zero/empty fields so the
 * criteria JSON doesn't pollute the DB with "priceMin: 0" when the
 * user didn't actually set a minimum.
 */
function criteriaToSavedSearchCriteria(c: SearchCriteria): SavedSearchCriteria {
  const out: SavedSearchCriteria = {};
  if (c.city) out.city = c.city;
  if (c.state) out.state = c.state;
  if (c.zip) out.zip = c.zip;
  if (c.propertyType && c.propertyType !== "any") {
    const pt = c.propertyType.toLowerCase().replace(/[-\s]/g, "_");
    if (
      pt === "single_family" ||
      pt === "condo" ||
      pt === "townhouse" ||
      pt === "multi_family"
    ) {
      out.propertyType = pt;
    }
  }
  if (c.minPrice && Number(c.minPrice) > 0) out.priceMin = Number(c.minPrice);
  if (c.maxPrice && Number(c.maxPrice) > 0) out.priceMax = Number(c.maxPrice);
  if (c.beds && Number(c.beds) > 0) out.bedsMin = Number(c.beds);
  if (c.baths && Number(c.baths) > 0) out.bathsMin = Number(c.baths);
  return out;
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 p-4 md:p-6">
          <div className="mx-auto max-w-7xl rounded-3xl border bg-white p-8 text-sm text-gray-500 shadow-sm">
            Loading search…
          </div>
        </div>
      }
    >
      <SearchPageInner />
    </Suspense>
  );
}
