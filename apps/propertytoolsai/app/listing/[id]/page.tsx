"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ListingDetailView } from "@/components/search/ListingDetailView";
import type { ListingResult } from "@/lib/listings/adapters/types";

export default function ListingDetailPage() {
  const params = useParams<{ id: string }>();
  const [listing, setListing] = useState<ListingResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!params?.id) return;
    let cancelled = false;
    void (async () => {
      try {
        setLoading(true);
        setError("");
        const res = await fetch(`/api/search/listing/${encodeURIComponent(params.id)}`, {
          cache: "no-store",
        });
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok || !json?.success) throw new Error(json?.error || "Failed to load listing");
        setListing(json.listing);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load listing");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params?.id]);

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        {loading ? (
          <div className="rounded-3xl border bg-white p-6 text-sm text-gray-500 shadow-sm">
            Loading listing...
          </div>
        ) : error ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
            {error}
          </div>
        ) : listing ? (
          <ListingDetailView listing={listing} />
        ) : null}
      </div>
    </div>
  );
}
