"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { HomesInBudgetResults } from "@/components/search/HomesInBudgetResults";
import type { ListingResult } from "@/lib/listings/adapters/types";

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
          <h1 className="text-4xl font-semibold tracking-tight text-gray-900">Homes in Your Budget</h1>
          <p className="mt-3 text-sm text-gray-600 md:text-base">
            {criteria?.maxPrice
              ? `Showing homes up to $${Number(criteria.maxPrice).toLocaleString()}`
              : "Showing homes"}
            {criteria?.zip ? ` near ${criteria.zip}` : criteria?.city ? ` near ${criteria.city}` : ""}
            .
          </p>
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
