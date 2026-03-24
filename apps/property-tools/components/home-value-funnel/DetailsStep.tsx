"use client";

import type { PropertyCondition, RenovationLevel } from "@/lib/homeValue/types";

export type FunnelPropertyDetails = {
  beds: number;
  baths: number;
  sqft: number;
  yearBuilt: number | null;
  lotSqft: number | null;
  propertyType: string;
  condition: PropertyCondition;
  renovation: RenovationLevel;
};

type Props = {
  details: FunnelPropertyDetails;
  onChange: (patch: Partial<FunnelPropertyDetails>) => void;
  onBack: () => void;
  onSubmit: () => void;
};

const CONDITIONS: PropertyCondition[] = ["poor", "fair", "average", "good", "excellent"];
const RENOS: { v: RenovationLevel; label: string }[] = [
  { v: "none", label: "None / not sure" },
  { v: "cosmetic", label: "Cosmetic updates" },
  { v: "major", label: "Major renovation" },
  { v: "full", label: "Full remodel" },
];

export default function DetailsStep({ details, onChange, onBack, onSubmit }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-gray-900 sm:text-3xl">Property details</h2>
        <p className="mt-2 text-sm text-gray-600 sm:text-base">
          Refine your inputs for a tighter estimated range. Defaults are typical when a field is unknown.
        </p>
      </div>

      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Property type</span>
          <select
            value={details.propertyType}
            onChange={(e) => onChange({ propertyType: e.target.value })}
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-[#0072ce] focus:ring-2 focus:ring-[#0072ce]/25"
          >
            <option value="single family">Single-family</option>
            <option value="condo">Condo / apartment</option>
            <option value="townhome">Townhome / row</option>
            <option value="multi family">Multi-unit (2–4)</option>
          </select>
        </label>

        <label>
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Beds</span>
          <input
            type="number"
            min={1}
            max={12}
            value={details.beds}
            onChange={(e) => onChange({ beds: Number(e.target.value) || 1 })}
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[#0072ce] focus:ring-2 focus:ring-[#0072ce]/25"
          />
        </label>
        <label>
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Baths</span>
          <input
            type="number"
            min={1}
            max={12}
            step={0.5}
            value={details.baths}
            onChange={(e) => onChange({ baths: Number(e.target.value) || 1 })}
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[#0072ce] focus:ring-2 focus:ring-[#0072ce]/25"
          />
        </label>

        <label>
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Sq ft (living)</span>
          <input
            type="number"
            min={300}
            max={50000}
            value={details.sqft}
            onChange={(e) => onChange({ sqft: Number(e.target.value) || 0 })}
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[#0072ce] focus:ring-2 focus:ring-[#0072ce]/25"
          />
        </label>
        <label>
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Year built</span>
          <input
            type="number"
            min={1800}
            max={new Date().getFullYear() + 1}
            value={details.yearBuilt ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              onChange({ yearBuilt: v === "" ? null : Number(v) });
            }}
            placeholder="Optional"
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[#0072ce] focus:ring-2 focus:ring-[#0072ce]/25"
          />
        </label>

        <label className="sm:col-span-2">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Lot size (sq ft)</span>
          <input
            type="number"
            min={0}
            value={details.lotSqft ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              onChange({ lotSqft: v === "" ? null : Number(v) });
            }}
            placeholder="Optional"
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[#0072ce] focus:ring-2 focus:ring-[#0072ce]/25"
          />
        </label>

        <label className="sm:col-span-2">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Condition</span>
          <select
            value={details.condition}
            onChange={(e) => onChange({ condition: e.target.value as PropertyCondition })}
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#0072ce] focus:ring-2 focus:ring-[#0072ce]/25"
          >
            {CONDITIONS.map((c) => (
              <option key={c} value={c}>
                {c.charAt(0).toUpperCase() + c.slice(1)}
              </option>
            ))}
          </select>
        </label>

        <label className="sm:col-span-2">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Recent renovations</span>
          <select
            value={details.renovation}
            onChange={(e) => onChange({ renovation: e.target.value as RenovationLevel })}
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#0072ce] focus:ring-2 focus:ring-[#0072ce]/25"
          >
            {RENOS.map((r) => (
              <option key={r.v} value={r.v}>
                {r.label}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-col gap-3 sm:col-span-2 sm:flex-row sm:justify-between">
          <button
            type="button"
            onClick={onBack}
            className="order-2 rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-800 hover:bg-gray-50 sm:order-1"
          >
            Back
          </button>
          <button
            type="submit"
            className="order-1 rounded-2xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white hover:bg-gray-800 sm:order-2 sm:min-w-[200px]"
          >
            Get my estimate
          </button>
        </div>
      </form>
    </div>
  );
}
