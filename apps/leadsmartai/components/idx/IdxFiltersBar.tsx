"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import type { IdxPropertyType } from "@/lib/idx/types";

const PROPERTY_TYPE_OPTIONS: { value: IdxPropertyType | ""; label: string }[] = [
  { value: "", label: "Any type" },
  { value: "single_family", label: "Single family" },
  { value: "condo", label: "Condo" },
  { value: "townhouse", label: "Townhouse" },
  { value: "multi_family", label: "Multi-family" },
];

type FilterState = {
  city: string;
  state: string;
  zip: string;
  priceMin: string;
  priceMax: string;
  bedsMin: string;
  bathsMin: string;
  propertyType: string;
};

function readFromSearchParams(sp: URLSearchParams): FilterState {
  return {
    city: sp.get("city") ?? "",
    state: sp.get("state") ?? "",
    zip: sp.get("zip") ?? "",
    priceMin: sp.get("priceMin") ?? "",
    priceMax: sp.get("priceMax") ?? "",
    bedsMin: sp.get("bedsMin") ?? "",
    bathsMin: sp.get("bathsMin") ?? "",
    propertyType: sp.get("propertyType") ?? "",
  };
}

export default function IdxFiltersBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initial = useMemo(() => readFromSearchParams(searchParams), [searchParams]);
  const [state, setState] = useState<FilterState>(initial);

  function update<K extends keyof FilterState>(key: K, value: FilterState[K]) {
    setState((s) => ({ ...s, [key]: value }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries(state)) {
      if (v && String(v).trim()) next.set(k, String(v).trim());
    }
    next.set("page", "1");
    router.push(`/homes/search?${next.toString()}`);
  }

  return (
    <form
      onSubmit={submit}
      className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-4"
    >
      <input
        value={state.city}
        onChange={(e) => update("city", e.target.value)}
        placeholder="City"
        className="rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <input
        value={state.state}
        onChange={(e) => update("state", e.target.value.toUpperCase().slice(0, 2))}
        placeholder="State (e.g. CA)"
        maxLength={2}
        className="rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <input
        value={state.zip}
        onChange={(e) => update("zip", e.target.value.replace(/\D/g, "").slice(0, 5))}
        placeholder="ZIP"
        inputMode="numeric"
        className="rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <select
        value={state.propertyType}
        onChange={(e) => update("propertyType", e.target.value)}
        className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {PROPERTY_TYPE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <input
        value={state.priceMin}
        onChange={(e) => update("priceMin", e.target.value.replace(/\D/g, ""))}
        placeholder="Min price"
        inputMode="numeric"
        className="rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <input
        value={state.priceMax}
        onChange={(e) => update("priceMax", e.target.value.replace(/\D/g, ""))}
        placeholder="Max price"
        inputMode="numeric"
        className="rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <input
        value={state.bedsMin}
        onChange={(e) => update("bedsMin", e.target.value.replace(/\D/g, ""))}
        placeholder="Min beds"
        inputMode="numeric"
        className="rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <input
        value={state.bathsMin}
        onChange={(e) => update("bathsMin", e.target.value.replace(/\D/g, ""))}
        placeholder="Min baths"
        inputMode="numeric"
        className="rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <button
        type="submit"
        className="md:col-span-4 inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
      >
        Search homes
      </button>
    </form>
  );
}
