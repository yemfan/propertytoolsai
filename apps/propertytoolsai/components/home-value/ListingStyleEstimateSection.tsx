"use client";

import React, { useMemo, useState } from "react";

export type PropertyPhoto = {
  id: string;
  url: string;
  alt?: string;
  width?: number;
  height?: number;
  source?: string;
};

export type ListingStyleProperty = {
  fullAddress: string;
  city?: string;
  state?: string;
  zip?: string;
  beds?: number;
  baths?: number;
  sqft?: number;
  lotSize?: number;
  yearBuilt?: number;
  propertyType?: string;
  estimateValue: number;
  rangeLow: number;
  rangeHigh: number;
  confidence: "low" | "medium" | "high";
  confidenceScore: number;
  medianPpsf?: number;
  weightedPpsf?: number;
  summary?: string;
  photos?: PropertyPhoto[];
};

function money(value?: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function confidenceClass(confidence: ListingStyleProperty["confidence"]) {
  switch (confidence) {
    case "high":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "medium":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "low":
      return "bg-red-50 text-red-700 border-red-200";
  }
}

export function PropertyHeroGallery({
  address,
  photos,
}: {
  address: string;
  photos: PropertyPhoto[];
}) {
  const [selected, setSelected] = useState(0);
  if (!photos.length) return null;

  const primary = photos[selected] ?? photos[0]!;
  const rest = photos.slice(0, 5);

  return (
    <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
      <div className="grid gap-2 p-2 lg:grid-cols-[1.35fr_0.65fr]">
        <div className="overflow-hidden rounded-3xl bg-gray-100">
          <img
            src={primary.url}
            alt={primary.alt || address}
            className="h-[420px] w-full object-cover"
          />
        </div>

        <div className="grid grid-cols-2 gap-2 lg:grid-cols-2">
          {rest.map((photo, index) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => setSelected(index)}
              className="overflow-hidden rounded-2xl border bg-gray-100 text-left"
            >
              <img
                src={photo.url}
                alt={photo.alt || `${address} photo ${index + 1}`}
                className="h-[205px] w-full object-cover transition hover:scale-[1.02]"
              />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

export function PropertyOverviewCard({
  property,
}: {
  property: ListingStyleProperty;
}) {
  return (
    <section className="rounded-3xl border bg-white p-6 shadow-sm md:p-8">
      <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-gray-900 md:text-4xl">
            {property.fullAddress}
          </h1>
          <p className="mt-2 text-sm text-gray-600 md:text-base">
            {[property.city, property.state, property.zip].filter(Boolean).join(", ")}
          </p>

          <div className="mt-5 flex flex-wrap gap-2 text-sm text-gray-700">
            <span className="rounded-full border bg-gray-50 px-3 py-1.5 font-medium">
              {property.beds ?? "—"} bd
            </span>
            <span className="rounded-full border bg-gray-50 px-3 py-1.5 font-medium">
              {property.baths ?? "—"} ba
            </span>
            <span className="rounded-full border bg-gray-50 px-3 py-1.5 font-medium">
              {property.sqft?.toLocaleString() || "—"} sqft
            </span>
            <span className="rounded-full border bg-gray-50 px-3 py-1.5 font-medium capitalize">
              {property.propertyType?.replaceAll("_", " ") || "Home"}
            </span>
          </div>
        </div>

        <div className="rounded-3xl border bg-gray-50 p-5 xl:min-w-[320px]">
          <div className="text-sm font-medium text-gray-500">Estimated Value</div>
          <div className="mt-2 text-4xl font-semibold tracking-tight text-gray-900">
            {money(property.estimateValue)}
          </div>
          <div className="mt-2 text-sm text-gray-600">
            Range {money(property.rangeLow)} - {money(property.rangeHigh)}
          </div>

          <div
            className={[
              "mt-4 inline-flex rounded-full border px-3 py-1 text-xs font-medium capitalize",
              confidenceClass(property.confidence),
            ].join(" ")}
          >
            Confidence {property.confidence} ({property.confidenceScore}/100)
          </div>
        </div>
      </div>

      {property.summary ? (
        <div className="mt-6 rounded-2xl bg-gray-50 p-4 text-sm leading-relaxed text-gray-700 md:text-base">
          {property.summary}
        </div>
      ) : null}
    </section>
  );
}

export function PropertyHighlightsGrid({
  property,
}: {
  property: ListingStyleProperty;
}) {
  const items = useMemo(
    () => [
      {
        label: "Median Price / Sqft",
        value: property.medianPpsf ? `${money(property.medianPpsf)}/sqft` : "—",
      },
      {
        label: "Weighted Price / Sqft",
        value: property.weightedPpsf ? `${money(property.weightedPpsf)}/sqft` : "—",
      },
      {
        label: "Year Built",
        value: property.yearBuilt?.toString() || "—",
      },
      {
        label: "Lot Size",
        value: property.lotSize ? `${property.lotSize.toLocaleString()} sqft` : "—",
      },
    ],
    [property]
  );

  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="rounded-3xl border bg-white p-5 shadow-sm">
          <div className="text-sm text-gray-500">{item.label}</div>
          <div className="mt-2 text-xl font-semibold text-gray-900">{item.value}</div>
        </div>
      ))}
    </section>
  );
}

export function PropertyPhotosSection({
  property,
}: {
  property: ListingStyleProperty;
}) {
  const photos = property.photos ?? [];

  return (
    <div className="space-y-6">
      <PropertyHeroGallery address={property.fullAddress} photos={photos} />
      <PropertyOverviewCard property={property} />
      <PropertyHighlightsGrid property={property} />
    </div>
  );
}

export function ListingStyleEstimateSection({
  property,
  children,
}: {
  property: ListingStyleProperty;
  children?: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <PropertyPhotosSection property={property} />
      {children}
    </div>
  );
}

export function normalizePropertyPhotos(input?: Array<any>): PropertyPhoto[] {
  if (!Array.isArray(input)) return [];

  return input
    .filter((item) => item?.url)
    .map((item, index) => ({
      id: String(item.id || `photo_${index + 1}`),
      url: String(item.url),
      alt: item.alt ? String(item.alt) : undefined,
      width: typeof item.width === "number" ? item.width : undefined,
      height: typeof item.height === "number" ? item.height : undefined,
      source: item.source ? String(item.source) : undefined,
    }));
}

export function ExampleListingStyleUsage({
  estimateResult,
  children,
}: {
  estimateResult: {
    property: {
      fullAddress: string;
      city?: string;
      state?: string;
      zip?: string;
      beds?: number;
      baths?: number;
      sqft?: number;
      lotSize?: number;
      yearBuilt?: number;
      propertyType?: string;
      photos?: Array<any>;
    };
    estimate: {
      value: number;
      rangeLow: number;
      rangeHigh: number;
      confidence: "low" | "medium" | "high";
      confidenceScore: number;
      summary?: string;
    };
    supportingData: {
      medianPpsf?: number;
      weightedPpsf?: number;
    };
  };
  children?: React.ReactNode;
}) {
  const property: ListingStyleProperty = {
    fullAddress: estimateResult.property.fullAddress,
    city: estimateResult.property.city,
    state: estimateResult.property.state,
    zip: estimateResult.property.zip,
    beds: estimateResult.property.beds,
    baths: estimateResult.property.baths,
    sqft: estimateResult.property.sqft,
    lotSize: estimateResult.property.lotSize,
    yearBuilt: estimateResult.property.yearBuilt,
    propertyType: estimateResult.property.propertyType,
    estimateValue: estimateResult.estimate.value,
    rangeLow: estimateResult.estimate.rangeLow,
    rangeHigh: estimateResult.estimate.rangeHigh,
    confidence: estimateResult.estimate.confidence,
    confidenceScore: estimateResult.estimate.confidenceScore,
    medianPpsf: estimateResult.supportingData.medianPpsf,
    weightedPpsf: estimateResult.supportingData.weightedPpsf,
    summary: estimateResult.estimate.summary,
    photos: normalizePropertyPhotos(estimateResult.property.photos),
  };

  return <ListingStyleEstimateSection property={property}>{children}</ListingStyleEstimateSection>;
}
