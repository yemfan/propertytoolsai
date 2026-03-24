"use client";

import type { HomeValueRefinements } from "@/lib/home-value/useHomeValueEstimate";
import type { PropertyCondition } from "@/lib/homeValue/types";

type Props = {
  value: HomeValueRefinements;
  onChange: (patch: Partial<HomeValueRefinements>) => void;
  disabled?: boolean;
};

const CONDITIONS: { value: PropertyCondition; label: string }[] = [
  { value: "poor", label: "Needs work" },
  { value: "fair", label: "Fair" },
  { value: "average", label: "Average" },
  { value: "good", label: "Good" },
  { value: "excellent", label: "Excellent" },
];

export function RefinementForm({ value, onChange, disabled }: Props) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900">Refine your estimate</h3>
      <p className="mt-1 text-xs text-slate-500">We&apos;ll refresh the model when you adjust details.</p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="block text-xs font-medium text-slate-600">
          Beds
          <input
            type="number"
            min={1}
            max={20}
            step={1}
            value={value.beds}
            onChange={(e) => onChange({ beds: Number(e.target.value) || 1 })}
            disabled={disabled}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#0072ce]/50 focus:ring-2 focus:ring-[#0072ce]/20 disabled:bg-slate-50"
          />
        </label>
        <label className="block text-xs font-medium text-slate-600">
          Baths
          <input
            type="number"
            min={1}
            max={20}
            step={0.5}
            value={value.baths}
            onChange={(e) => onChange({ baths: Number(e.target.value) || 1 })}
            disabled={disabled}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#0072ce]/50 focus:ring-2 focus:ring-[#0072ce]/20 disabled:bg-slate-50"
          />
        </label>
        <label className="block text-xs font-medium text-slate-600">
          Sq ft (living)
          <input
            type="number"
            min={300}
            max={50000}
            step={50}
            value={value.sqft}
            onChange={(e) => onChange({ sqft: Number(e.target.value) || 300 })}
            disabled={disabled}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#0072ce]/50 focus:ring-2 focus:ring-[#0072ce]/20 disabled:bg-slate-50"
          />
        </label>
        <label className="block text-xs font-medium text-slate-600">
          Year built
          <input
            type="number"
            min={1800}
            max={new Date().getFullYear() + 1}
            step={1}
            placeholder="Optional"
            value={value.yearBuilt ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              onChange({ yearBuilt: v === "" ? null : Number(v) || null });
            }}
            disabled={disabled}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#0072ce]/50 focus:ring-2 focus:ring-[#0072ce]/20 disabled:bg-slate-50"
          />
        </label>
        <label className="block text-xs font-medium text-slate-600 sm:col-span-2 lg:col-span-1">
          Condition
          <select
            value={value.condition}
            onChange={(e) => onChange({ condition: e.target.value as PropertyCondition })}
            disabled={disabled}
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#0072ce]/50 focus:ring-2 focus:ring-[#0072ce]/20 disabled:bg-slate-50"
          >
            {CONDITIONS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-3 sm:col-span-2 lg:col-span-3">
          <input
            type="checkbox"
            checked={value.renovatedRecently}
            onChange={(e) => onChange({ renovatedRecently: e.target.checked })}
            disabled={disabled}
            className="h-4 w-4 rounded border-slate-300 text-[#0072ce] focus:ring-[#0072ce]"
          />
          <span className="text-sm text-slate-700">Recently renovated (major cosmetic updates)</span>
        </label>
      </div>
    </div>
  );
}
