"use client";

import AddressAutocomplete from "@/components/AddressAutocomplete";
import { useAddressPrefill } from "@/hooks/useAddressPrefill";
import { useState } from "react";

type Comparable = {
  address: string;
  salePrice: number;
  sqft: number;
  pricePerSqft: number;
  distanceMiles: number;
  soldDate: string;
};

type PropertyDetails = {
  address: string;
  beds: number;
  baths: number;
  sqft: number;
  lotSize: number;
  yearBuilt: number;
  propertyType: string;
};

type ApiResponse = {
  property: PropertyDetails;
  comps: Comparable[];
  avgPricePerSqft: number | null;
  estimatedValue: number | null;
  low: number | null;
  high: number | null;
  summary: string;
};

export default function HomeValueEstimatorPage() {
  const { address, setAddress, saveSelectedAddress } = useAddressPrefill();
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleEstimate = async () => {
    if (!address.trim()) {
      setError("Please enter a property address.");
      return;
    }
    setError(null);
    setLoading(true);
    setResult(null);

    try {
      // Pull comps (with sold_price/sold_date) from the warehouse-backed API.
      // MLS CSV import populates `property_snapshots` for sold history, and
      // `getComparables()` maps that into `property_comps`.
      const res = await fetch(
        `/api/property/${encodeURIComponent(address.trim())}`,
        { method: "GET" }
      );

      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error ?? "Failed to fetch property comps.");
      }

      const property = json?.property as any;
      const compsRaw = (json?.comps ?? []) as any[];

      const comps: Comparable[] = compsRaw
        .map((c) => {
          const compProp = c?.comp_property;
          const salePriceNum = Number(c?.sold_price ?? 0);
          const sqftNum = Number(compProp?.sqft ?? 0);
          if (!salePriceNum || !sqftNum) return null;

          const pricePerSqft = salePriceNum / sqftNum;
          const soldDateStr = c?.sold_date
            ? new Date(c.sold_date).toLocaleDateString()
            : "—";

          return {
            address: compProp?.address ?? "—",
            salePrice: salePriceNum,
            sqft: sqftNum,
            pricePerSqft,
            distanceMiles: Number(c?.distance_miles ?? 0),
            soldDate: soldDateStr,
          } satisfies Comparable;
        })
        .filter(Boolean) as Comparable[];

      const avgPricePerSqft =
        comps.length > 0
          ? comps.reduce((sum, c) => sum + c.pricePerSqft, 0) / comps.length
          : null;

      const subjectSqft = Number(property?.sqft ?? 0) || comps[0]?.sqft || 1500;
      const estimatedValue =
        avgPricePerSqft != null ? avgPricePerSqft * subjectSqft : null;
      const low = estimatedValue != null ? estimatedValue * 0.92 : null;
      const high = estimatedValue != null ? estimatedValue * 1.08 : null;

      const summary =
        estimatedValue != null
          ? `Based on recent comparable sold properties, the estimated value of this property is approximately $${Math.round(
              estimatedValue
            ).toLocaleString()}.`
          : "We couldn’t find enough comparable sold data yet. Import MLS CSV sold history first.";

      const data: ApiResponse = {
        property: {
          address: String(property?.address ?? address.trim()),
          beds: Number(property?.beds ?? 0),
          baths: Number(property?.baths ?? 0),
          sqft: subjectSqft,
          lotSize: Number(property?.lot_size ?? 0),
          yearBuilt: Number(property?.year_built ?? 0),
          propertyType: String(property?.property_type ?? "—"),
        },
        comps,
        avgPricePerSqft,
        estimatedValue,
        low,
        high,
        summary,
      };

      setResult(data);
    } catch (err: any) {
      setError(err.message || "Unexpected error");
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number | null) =>
    value == null ? "—" : `$${Math.round(value).toLocaleString()}`;

  return (
    <div className="w-full max-w-5xl space-y-6 py-6">
      <div className="bg-white shadow rounded-xl p-6 border border-gray-100">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Home Value Estimator
        </h1>
        <p className="text-sm text-gray-600 mb-4">
          Enter a property address to estimate its current market value based on
          recent comparable sales.
        </p>
        <div className="flex flex-col md:flex-row gap-3 items-stretch">
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
            placeholder="123 Main St, City, State"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleEstimate}
            disabled={loading}
            className="inline-flex items-center justify-center bg-blue-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed min-w-[140px]"
          >
            {loading && (
              <span className="mr-2 inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            {loading ? "Estimating..." : "Estimate Value"}
          </button>
        </div>
        {error && (
          <p className="mt-2 text-xs text-red-600 font-medium">{error}</p>
        )}
      </div>

      {result && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white shadow rounded-lg p-4 border border-gray-100">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Estimated Home Value
              </h2>
              <p className="text-2xl font-bold text-blue-700">
                {formatCurrency(result.estimatedValue)}
              </p>
              {result.avgPricePerSqft && (
                <p className="text-xs text-gray-500 mt-1">
                  Avg. price/sqft: $
                  {result.avgPricePerSqft.toFixed(0).toLocaleString()}
                </p>
              )}
            </div>
            <div className="bg-white shadow rounded-lg p-4 border border-gray-100">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Estimated Range
              </h2>
              <p className="text-sm font-semibold text-gray-800">
                {formatCurrency(result.low)} – {formatCurrency(result.high)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Range uses ±8% around the point estimate.
              </p>
            </div>
            <div className="bg-white shadow rounded-lg p-4 border border-gray-100">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Property Snapshot
              </h2>
              <p className="text-sm text-gray-800 font-medium">
                {result.property.address}
              </p>
              <p className="text-xs text-gray-600 mt-1">
                {result.property.beds} beds • {result.property.baths} baths •{" "}
                {result.property.sqft.toLocaleString()} sqft
              </p>
              <p className="text-xs text-gray-600">
                {result.property.propertyType} • Built{" "}
                {result.property.yearBuilt}
              </p>
            </div>
          </div>

          <div className="bg-white shadow rounded-xl p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-gray-900">
                Comparable Sales (Last 6 Months, &lt;= 0.5 Miles)
              </h2>
              <span className="text-xs text-gray-500">
                {result.comps.length} comps used
              </span>
            </div>
            {result.comps.length === 0 ? (
              <p className="text-sm text-gray-600">
                No comparable sales matched the current filters.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-gray-50 text-left text-gray-600">
                      <th className="px-3 py-2 font-semibold">Address</th>
                      <th className="px-3 py-2 font-semibold">Sale Price</th>
                      <th className="px-3 py-2 font-semibold">Sqft</th>
                      <th className="px-3 py-2 font-semibold">Price/Sqft</th>
                      <th className="px-3 py-2 font-semibold">Distance</th>
                      <th className="px-3 py-2 font-semibold">Sold Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.comps.map((c, idx) => (
                      <tr
                        key={idx}
                        className="border-t border-gray-100 hover:bg-gray-50"
                      >
                        <td className="px-3 py-2 whitespace-nowrap">
                          {c.address}
                        </td>
                        <td className="px-3 py-2">
                          ${c.salePrice.toLocaleString()}
                        </td>
                        <td className="px-3 py-2">
                          {c.sqft.toLocaleString()}
                        </td>
                        <td className="px-3 py-2">
                          ${c.pricePerSqft.toFixed(0)}
                        </td>
                        <td className="px-3 py-2">
                          {c.distanceMiles.toFixed(2)} mi
                        </td>
                        <td className="px-3 py-2">{c.soldDate}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 bg-blue-50 border border-blue-100 rounded-lg p-4 text-sm text-blue-900">
              <h2 className="text-sm font-semibold mb-2">AI Summary</h2>
              <p>{result.summary}</p>
            </div>
            <div className="bg-white border border-gray-100 rounded-lg p-4 text-sm shadow-sm">
              <h2 className="text-sm font-semibold mb-2">
                Get a Personalized Review
              </h2>
              <p className="text-xs text-gray-600 mb-3">
                Share your contact info and a local real estate professional can
                provide a more detailed valuation.
              </p>
              <div className="space-y-2">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email"
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Phone (optional)"
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  className="w-full bg-blue-600 text-white text-xs font-semibold py-2 rounded hover:bg-blue-700"
                >
                  Request Expert Valuation
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

