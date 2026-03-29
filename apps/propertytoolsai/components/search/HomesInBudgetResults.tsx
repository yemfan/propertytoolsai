"use client";

import React from "react";
import Link from "next/link";
import type { ListingResult } from "@/lib/listings/adapters/types";
import { ListingLeadActions } from "./ListingLeadActions";

export type SearchHome = ListingResult;

function money(value?: number) {
  if (typeof value !== "number") return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function HomesInBudgetResults({ homes }: { homes: ListingResult[] }) {
  return (
    <section className="space-y-4">
      {homes.length === 0 ? (
        <div className="rounded-3xl border bg-white p-6 text-sm text-gray-500 shadow-sm">
          No homes found for this budget yet.
        </div>
      ) : (
        homes.map((home) => (
          <article key={home.id} className="overflow-hidden rounded-3xl border bg-white shadow-sm">
            <div className="grid md:grid-cols-[320px_1fr]">
              <div className="bg-gray-100">
                {home.photoUrl ? (
                  <img
                    src={home.photoUrl}
                    alt={home.address}
                    className="h-full min-h-[220px] w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full min-h-[220px] items-center justify-center text-sm text-gray-500">
                    No photo
                  </div>
                )}
              </div>
              <div className="p-6">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h2 className="text-2xl font-semibold tracking-tight text-gray-900">
                      {money(home.price)}
                    </h2>
                    <div className="mt-1 text-sm text-gray-600">{home.address}</div>
                    <div className="mt-1 text-sm text-gray-600">
                      {home.city}, {home.state} {home.zip}
                    </div>
                  </div>
                  <div className="rounded-2xl border bg-gray-50 px-4 py-3 text-sm capitalize text-gray-700">
                    {(home.propertyType || "home").replaceAll("_", " ")}
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-2 text-sm text-gray-700">
                  <span className="rounded-full border bg-gray-50 px-3 py-1.5">{home.beds ?? "—"} bd</span>
                  <span className="rounded-full border bg-gray-50 px-3 py-1.5">{home.baths ?? "—"} ba</span>
                  <span className="rounded-full border bg-gray-50 px-3 py-1.5">
                    {home.sqft != null ? home.sqft.toLocaleString() : "—"} sqft
                  </span>
                </div>

                <div className="mt-5 flex flex-wrap items-start gap-3">
                  <Link
                    href={`/listing/${encodeURIComponent(home.id)}`}
                    className="rounded-2xl bg-gray-900 px-5 py-3 text-sm font-medium text-white"
                  >
                    View Details
                  </Link>
                  <ListingLeadActions
                    compact
                    listing={{
                      id: home.id,
                      address: home.address,
                      city: home.city,
                      zip: home.zip,
                      price: home.price,
                    }}
                  />
                </div>
              </div>
            </div>
          </article>
        ))
      )}
    </section>
  );
}
