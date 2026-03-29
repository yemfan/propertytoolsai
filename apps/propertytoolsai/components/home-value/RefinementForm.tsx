"use client";

import type { EstimateDetails, PropertyCondition, PropertyType } from "@/lib/home-value/types";

const fieldBorder = "w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-gray-400";

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step,
}: {
  label: string;
  value?: number;
  onChange: (value?: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm text-gray-600">{label}</label>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
        className={fieldBorder}
      />
    </div>
  );
}

type Props = {
  details: EstimateDetails;
  onChange: (patch: Partial<EstimateDetails>) => void;
  onRefresh: () => void;
  isBusy: boolean;
};

export function RefinementForm({ details, onChange, onRefresh, isBusy }: Props) {
  const yearMax = new Date().getFullYear() + 1;

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-gray-900">Want a More Accurate Estimate?</h2>
          <p className="mt-2 text-sm text-gray-600 md:text-base">
            Add a few details and refresh the estimate to improve confidence.
          </p>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={isBusy}
          className="rounded-2xl bg-gray-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          {isBusy ? "Updating..." : "Update Estimate"}
        </button>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <NumberField label="Bedrooms" value={details.beds} min={0} onChange={(v) => onChange({ beds: v })} />
        <NumberField
          label="Bathrooms"
          value={details.baths}
          min={0}
          step={0.5}
          onChange={(v) => onChange({ baths: v })}
        />
        <NumberField label="Square Feet" value={details.sqft} min={100} onChange={(v) => onChange({ sqft: v })} />
        <NumberField
          label="Year Built"
          value={details.yearBuilt}
          min={1800}
          max={yearMax}
          onChange={(v) => onChange({ yearBuilt: v })}
        />
        <NumberField label="Lot Size" value={details.lotSize} min={0} onChange={(v) => onChange({ lotSize: v })} />

        <div>
          <label className="mb-1 block text-sm text-gray-600">Property Type</label>
          <select
            value={details.propertyType ?? ""}
            onChange={(e) =>
              onChange({
                propertyType: e.target.value ? (e.target.value as PropertyType) : undefined,
              })
            }
            className={`${fieldBorder} bg-white`}
          >
            <option value="">Select type</option>
            <option value="single_family">Single Family</option>
            <option value="condo">Condo</option>
            <option value="townhome">Townhome</option>
            <option value="multi_family">Multi Family</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm text-gray-600">Condition</label>
          <select
            value={details.condition ?? ""}
            onChange={(e) =>
              onChange({
                condition: e.target.value ? (e.target.value as PropertyCondition) : undefined,
              })
            }
            className={`${fieldBorder} bg-white`}
          >
            <option value="">Select condition</option>
            <option value="poor">Poor</option>
            <option value="fair">Fair</option>
            <option value="good">Good</option>
            <option value="excellent">Excellent</option>
          </select>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3">
          <input
            id="renovatedRecently"
            type="checkbox"
            checked={!!details.renovatedRecently}
            onChange={(e) => onChange({ renovatedRecently: e.target.checked })}
            className="h-4 w-4"
          />
          <label htmlFor="renovatedRecently" className="text-sm text-gray-700">
            Renovated recently
          </label>
        </div>
      </div>
    </section>
  );
}
