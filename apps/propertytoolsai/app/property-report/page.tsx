"use client";

import AddressAutocomplete from "@/components/AddressAutocomplete";
import { useRouter } from "next/navigation";
import { FormEvent } from "react";
import { useAddressPrefill } from "@/hooks/useAddressPrefill";

export default function PropertyReportEntryPage() {
  const router = useRouter();
  const { address, setAddress, saveSelectedAddress } = useAddressPrefill();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = address.trim();
    if (!trimmed) return;
    const slug = encodeURIComponent(
      trimmed.toLowerCase().replace(/\s+/g, "-")
    );
    router.push(`/property/${slug}`);
  };

  return (
    <div className="w-full max-w-3xl py-6">
      <div className="bg-white shadow rounded-xl p-6 border border-gray-100">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Property Report Generator
        </h1>
        <p className="text-sm text-gray-600 mb-4">
          Generate a complete property report that combines home value, comps,
          rental potential, investment metrics, and mortgage estimate into a
          single view.
        </p>
        <form
          onSubmit={handleSubmit}
          className="flex flex-col sm:flex-row gap-3 items-stretch"
        >
          <AddressAutocomplete
            value={address}
            onChange={setAddress}
            onBlur={() => {
              const t = address.trim();
              if (t)
                saveSelectedAddress({
                  formattedAddress: t,
                  lat: null,
                  lng: null,
                  placeId: null,
                  city: null,
                  state: null,
                  zip: null,
                });
            }}
            onSelect={(val) =>
              saveSelectedAddress({
                formattedAddress: val.formattedAddress,
                lat: val.lat,
                lng: val.lng,
                placeId: val.placeId ?? null,
                city: val.city ?? null,
                state: val.state ?? null,
                zip: val.zip ?? null,
              })
            }
            placeholder="Enter property address"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            className="inline-flex items-center justify-center bg-blue-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed min-w-[140px]"
            disabled={!address.trim()}
          >
            Generate Report
          </button>
        </form>
        <p className="mt-2 text-xs text-gray-500">
          Your report will be available at a shareable URL using the property
          address.
        </p>
      </div>
    </div>
  );
}

