"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ListingResult } from "@/lib/listings/adapters/types";
import { trackEvent } from "@/lib/marketing/trackEvent";

function money(value?: number) {
  if (typeof value !== "number") return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function SeoListingsGrid({
  query,
  seoPageSlug,
}: {
  query: {
    city: string;
    state: string;
    zip?: string;
    maxPrice?: number;
    beds?: number;
    propertyType?: string;
  };
  seoPageSlug?: string;
}) {
  const [listings, setListings] = useState<ListingResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const qs = new URLSearchParams();
    qs.set("city", query.city);
    qs.set("state", query.state);
    if (query.zip?.trim()) qs.set("zip", query.zip.trim());
    if (query.maxPrice) qs.set("maxPrice", String(query.maxPrice));
    if (query.beds) qs.set("beds", String(query.beds));
    if (query.propertyType) qs.set("propertyType", query.propertyType);

    let cancelled = false;
    setLoading(true);

    void (async () => {
      try {
        const res = await fetch(`/api/search/homes-in-budget?${qs.toString()}`, { cache: "no-store" });
        const json = (await res.json()) as { success?: boolean; results?: ListingResult[] };
        if (!cancelled && json?.success) setListings(json.results || []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [query.city, query.state, query.zip, query.maxPrice, query.beds, query.propertyType]);

  return (
    <section className="rounded-3xl border bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-gray-900">Homes available now</h2>
      {loading ? (
        <p className="mt-4 text-sm text-gray-500">Loading listings…</p>
      ) : listings.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500">No listings match these filters right now. Try Smart Match or adjust your search.</p>
      ) : (
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {listings.map((listing) => (
            <Link
              key={listing.id}
              href={`/listing/${listing.id}`}
              className="overflow-hidden rounded-2xl border bg-gray-50 hover:bg-white"
              onClick={() =>
                trackEvent("seo_listing_click", {
                  listing_id: listing.id,
                  seo_slug: seoPageSlug ?? null,
                })
              }
            >
              {listing.photoUrl ? (
                <img src={listing.photoUrl} alt={listing.address} className="h-[180px] w-full object-cover" />
              ) : null}
              <div className="p-4">
                <div className="font-semibold text-gray-900">{money(listing.price)}</div>
                <div className="mt-1 text-sm text-gray-700">{listing.address}</div>
                <div className="mt-2 text-xs text-gray-500">
                  {listing.beds ?? "—"} bd • {listing.baths ?? "—"} ba • {listing.sqft?.toLocaleString() || "—"} sqft
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
