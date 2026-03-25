"use client";

import React, { useMemo, useState } from "react";
import type { ListingResult } from "@/lib/listings/adapters/types";
import { ListingLeadActions } from "./ListingLeadActions";
import { ListingTourRequestForm } from "./ListingTourRequestForm";

function money(value?: number) {
  if (typeof value !== "number") return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function ListingDetailView({ listing }: { listing: ListingResult }) {
  const [selected, setSelected] = useState(0);
  const photos = useMemo(() => {
    if (listing.photos?.length) return listing.photos;
    if (listing.photoUrl) return [listing.photoUrl];
    return [];
  }, [listing.photos, listing.photoUrl]);
  const primary = photos[selected] || listing.photoUrl;

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
        <div className="grid gap-2 p-2 lg:grid-cols-[1.35fr_0.65fr]">
          <div className="overflow-hidden rounded-3xl bg-gray-100">
            {primary ? (
              <img src={primary} alt={listing.address} className="h-[420px] w-full object-cover" />
            ) : (
              <div className="flex h-[420px] items-center justify-center text-sm text-gray-500">
                No photo
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {photos.slice(0, 4).map((photo, index) => (
              <button
                key={`${photo}_${index}`}
                type="button"
                onClick={() => setSelected(index)}
                className="overflow-hidden rounded-2xl border bg-gray-100"
              >
                <img
                  src={photo}
                  alt={`${listing.address} ${index + 1}`}
                  className="h-[205px] w-full object-cover"
                />
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-3xl border bg-white p-6 shadow-sm md:p-8">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight text-gray-900">
              {money(listing.price)}
            </h1>
            <p className="mt-2 text-base text-gray-700">{listing.address}</p>
            <p className="mt-1 text-sm text-gray-600">
              {listing.city}, {listing.state} {listing.zip}
            </p>
            <div className="mt-5 flex flex-wrap gap-2 text-sm text-gray-700">
              <span className="rounded-full border bg-gray-50 px-3 py-1.5">{listing.beds ?? "—"} bd</span>
              <span className="rounded-full border bg-gray-50 px-3 py-1.5">{listing.baths ?? "—"} ba</span>
              <span className="rounded-full border bg-gray-50 px-3 py-1.5">
                {listing.sqft != null ? listing.sqft.toLocaleString() : "—"} sqft
              </span>
              <span className="rounded-full border bg-gray-50 px-3 py-1.5 capitalize">
                {listing.propertyType?.replaceAll("_", " ") || "Home"}
              </span>
            </div>
          </div>

          <div className="rounded-3xl border bg-gray-50 p-5 xl:min-w-[320px]">
            <div className="text-sm text-gray-500">Listing details</div>
            <div className="mt-3 space-y-2 text-sm text-gray-700">
              <div>Days on market: {listing.daysOnMarket ?? "—"}</div>
              <div>Year built: {listing.yearBuilt ?? "—"}</div>
              <div>Lot size: {listing.lotSize != null ? listing.lotSize.toLocaleString() : "—"}</div>
              <div>MLS #: {listing.mlsNumber || "—"}</div>
            </div>
          </div>
        </div>

        {listing.description ? (
          <div className="mt-6 rounded-2xl bg-gray-50 p-4 text-sm leading-relaxed text-gray-700">
            {listing.description}
          </div>
        ) : null}
      </section>

      <section className="rounded-3xl border bg-white p-6 shadow-sm md:p-8">
        <h2 className="text-2xl font-semibold tracking-tight text-gray-900">Ask About This Home</h2>
        <p className="mt-2 text-sm text-gray-600 md:text-base">
          Contact an agent directly from this listing and send the inquiry into your CRM.
        </p>
        <div className="mt-5">
          <ListingLeadActions
            listing={{
              id: listing.id,
              address: listing.address,
              city: listing.city,
              zip: listing.zip,
              price: listing.price,
            }}
          />
        </div>
      </section>

      <ListingTourRequestForm
        listing={{
          id: listing.id,
          address: listing.address,
          city: listing.city,
          zip: listing.zip,
          price: listing.price,
        }}
      />
    </div>
  );
}
