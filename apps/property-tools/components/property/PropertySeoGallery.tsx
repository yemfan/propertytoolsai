"use client";

/**
 * Optional gallery strip; primary photo UX lives in {@link PropertySeoHero}.
 */
import React from "react";
import type { PropertySeoRecord } from "@/lib/property-seo/types";

export function PropertySeoGallery({ record }: { record: PropertySeoRecord }) {
  const photos = record.photos || [];
  if (photos.length <= 1) return null;

  return (
    <section className="rounded-3xl border bg-white p-4 shadow-sm">
      <h2 className="px-2 text-lg font-semibold text-gray-900">Photos</h2>
      <div className="mt-3 flex gap-3 overflow-x-auto pb-2">
        {photos.map((p) => (
          <img
            key={p.id}
            src={p.url}
            alt={p.alt || record.fullAddress}
            className="h-28 w-40 shrink-0 rounded-xl object-cover"
          />
        ))}
      </div>
    </section>
  );
}
