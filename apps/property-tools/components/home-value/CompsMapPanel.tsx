"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import type { ComparableHome, SubjectHome } from "./homeValueCompsShared";
import {
  confidenceClass,
  fmtDate,
  money,
  normalizeAdjustments,
} from "./homeValueCompsShared";

export type { ComparableHome, SubjectHome } from "./homeValueCompsShared";

const HomeValueCompsMapInner = dynamic(() => import("./HomeValueCompsMapInner"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[520px] items-center justify-center border-b bg-gray-50 text-sm text-gray-500 lg:border-b-0 lg:border-r">
      Loading map…
    </div>
  ),
});

export function CompsMapPanel({
  subject,
  comps,
}: {
  subject: SubjectHome;
  comps: ComparableHome[];
}) {
  const [selectedId, setSelectedId] = useState<string | null>(comps[0]?.id ?? null);

  return (
    <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
      <div className="border-b px-6 py-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-gray-900">
              Comparable Homes Nearby
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              See how recent nearby sales support the estimate.
            </p>
          </div>

          <div
            className={[
              "inline-flex rounded-full border px-3 py-1 text-xs font-medium capitalize",
              confidenceClass(subject.confidence),
            ].join(" ")}
          >
            Confidence {subject.confidence} ({subject.confidenceScore}/100)
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1.15fr_0.85fr]">
        <HomeValueCompsMapInner
          subject={subject}
          comps={comps}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
        <ComparableHomesList comps={comps} selectedId={selectedId} onSelect={setSelectedId} />
      </div>
    </section>
  );
}

export function ComparableHomesList({
  comps,
  selectedId,
  onSelect,
}: {
  comps: ComparableHome[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="max-h-[520px] overflow-y-auto p-4 md:p-5">
      <div className="space-y-3">
        {comps.length === 0 ? (
          <div className="rounded-2xl border bg-gray-50 p-4 text-sm text-gray-500">
            No comparable homes available yet.
          </div>
        ) : (
          comps.map((comp, index) => {
            const selected = comp.id === selectedId;
            return (
              <button
                key={comp.id}
                type="button"
                onClick={() => onSelect(comp.id)}
                className={[
                  "block w-full rounded-2xl border p-4 text-left transition",
                  selected
                    ? "border-gray-900 bg-gray-900 text-white"
                    : "bg-gray-50 hover:bg-white",
                ].join(" ")}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-medium uppercase tracking-wide opacity-70">
                      Comp #{index + 1}
                    </div>
                    <div className="mt-1 font-semibold">{comp.address}</div>
                    <div className="mt-1 text-xs opacity-80">Sold {fmtDate(comp.soldDate)}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{money(comp.soldPrice)}</div>
                    <div className="mt-1 text-xs opacity-80">
                      {comp.pricePerSqft ? `${money(comp.pricePerSqft)}/sqft` : "—"}
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2 text-xs opacity-85">
                  <span className="rounded-full border px-2 py-1">
                    {comp.sqft?.toLocaleString() || "—"} sqft
                  </span>
                  <span className="rounded-full border px-2 py-1">
                    {comp.beds ?? "—"} bd / {comp.baths ?? "—"} ba
                  </span>
                  <span className="rounded-full border px-2 py-1">
                    {comp.distanceMiles.toFixed(2)} mi
                  </span>
                  <span className="rounded-full border px-2 py-1">
                    Match {(comp.similarityScore * 100).toFixed(0)}
                  </span>
                </div>

                {comp.matchReasons?.length ? (
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    {comp.matchReasons.map((reason) => (
                      <span
                        key={reason}
                        className={[
                          "rounded-full px-2 py-1",
                          selected ? "bg-white/10" : "bg-white border",
                        ].join(" ")}
                      >
                        {reason}
                      </span>
                    ))}
                  </div>
                ) : null}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

export function EstimateExplainabilityPanel({
  subject,
}: {
  subject: SubjectHome;
}) {
  const adjustmentRows = normalizeAdjustments(subject.adjustments);

  return (
    <section className="rounded-3xl border bg-white p-6 shadow-sm md:p-8">
      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-gray-900">
            Why This Estimate
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-gray-600 md:text-base">
            This estimate is anchored by nearby sold homes, weighted by similarity and distance.
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <MetricCard label="Estimated Value" value={money(subject.estimateValue)} />
            <MetricCard
              label="Range"
              value={`${money(subject.rangeLow)} - ${money(subject.rangeHigh)}`}
            />
            <MetricCard label="Median Price / Sqft" value={`${money(subject.medianPpsf)}/sqft`} />
            <MetricCard
              label="Subject Home Size"
              value={subject.sqft ? `${subject.sqft.toLocaleString()} sqft` : "—"}
            />
          </div>

          {subject.summary ? (
            <div className="mt-6 rounded-2xl bg-gray-50 p-4 text-sm leading-relaxed text-gray-700">
              {subject.summary}
            </div>
          ) : null}
        </div>

        <div>
          <h3 className="text-lg font-semibold text-gray-900">Adjustment Factors</h3>
          <div className="mt-4 space-y-3">
            {adjustmentRows.length === 0 ? (
              <div className="rounded-2xl border bg-gray-50 p-4 text-sm text-gray-500">
                No major valuation adjustments were applied.
              </div>
            ) : (
              adjustmentRows.map((item) => {
                const positive = item.value > 0;
                return (
                  <div
                    key={item.key}
                    className="flex items-center justify-between rounded-2xl border px-4 py-3"
                  >
                    <div className="text-sm font-medium text-gray-900">{item.label}</div>
                    <div
                      className={[
                        "text-sm font-semibold",
                        positive ? "text-emerald-700" : "text-red-700",
                      ].join(" ")}
                    >
                      {positive ? "+" : ""}
                      {money(item.value)}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="mt-6 rounded-2xl border bg-gray-50 p-4">
            <div className="text-sm font-medium text-gray-900">Confidence Explanation</div>
            <div className="mt-2 text-sm text-gray-600">
              A higher confidence score means the estimate is supported by more nearby, recent, and
              similar sold properties.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-gray-50 p-4">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="mt-2 text-xl font-semibold text-gray-900">{value}</div>
    </div>
  );
}

export function ExampleHomeValueCompsSection({
  apiResponse,
}: {
  apiResponse: {
    property: {
      fullAddress: string;
      lat: number;
      lng: number;
      sqft?: number;
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
      medianPpsf: number;
      weightedPpsf?: number;
    };
    adjustments?: Record<string, number>;
    comps: ComparableHome[];
  };
}) {
  const subject: SubjectHome = {
    address: apiResponse.property.fullAddress,
    lat: apiResponse.property.lat,
    lng: apiResponse.property.lng,
    sqft: apiResponse.property.sqft,
    estimateValue: apiResponse.estimate.value,
    rangeLow: apiResponse.estimate.rangeLow,
    rangeHigh: apiResponse.estimate.rangeHigh,
    confidence: apiResponse.estimate.confidence,
    confidenceScore: apiResponse.estimate.confidenceScore,
    medianPpsf: apiResponse.supportingData.medianPpsf,
    weightedPpsf: apiResponse.supportingData.weightedPpsf,
    summary: apiResponse.estimate.summary,
    adjustments: apiResponse.adjustments,
  };

  return (
    <div className="space-y-6">
      <EstimateExplainabilityPanel subject={subject} />
      <CompsMapPanel subject={subject} comps={apiResponse.comps} />
    </div>
  );
}
