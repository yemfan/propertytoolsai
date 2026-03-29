"use client";

import React from "react";
import type { PropertySeoRecord } from "@/lib/property-seo/types";
import { PropertySeoHero } from "./PropertySeoHero";
import { PropertySeoStats } from "./PropertySeoStats";
import { PropertySeoOverview } from "./PropertySeoOverview";
import { PropertySeoEstimateCard } from "./PropertySeoEstimateCard";
import { PropertySeoAffordabilityCard } from "./PropertySeoAffordabilityCard";
import { PropertySeoCompsPreview } from "./PropertySeoCompsPreview";
import { PropertySeoNearbyListings } from "./PropertySeoNearbyListings";
import { PropertySeoLeadCapture } from "./PropertySeoLeadCapture";
import { PropertySeoFaq } from "./PropertySeoFaq";
import { PropertySeoInternalLinks } from "./PropertySeoInternalLinks";

export function PropertySeoPage({ record }: { record: PropertySeoRecord }) {
  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <PropertySeoHero record={record} />
        <PropertySeoStats record={record} />

        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-6">
            <PropertySeoOverview record={record} />
            <PropertySeoCompsPreview record={record} />
            <PropertySeoFaq record={record} />
          </div>

          <div className="space-y-6">
            <PropertySeoEstimateCard record={record} />
            <PropertySeoAffordabilityCard record={record} />
            <PropertySeoLeadCapture record={record} />
          </div>
        </div>

        <PropertySeoNearbyListings record={record} />
        <PropertySeoInternalLinks record={record} />
      </div>
    </div>
  );
}
