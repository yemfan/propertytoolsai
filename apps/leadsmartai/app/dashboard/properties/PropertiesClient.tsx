"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type PropertyRow = {
  id: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  property_type: string | null;
  year_built: number | null;
};

export default function PropertiesClient({ properties }: { properties: PropertyRow[] }) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  const types = useMemo(() => {
    const set = new Set<string>();
    properties.forEach((p) => { if (p.property_type) set.add(p.property_type); });
    return Array.from(set).sort();
  }, [properties]);

  const filtered = properties.filter((p) => {
    if (typeFilter !== "all" && p.property_type !== typeFilter) return false;
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (p.address ?? "").toLowerCase().includes(s) || (p.city ?? "").toLowerCase().includes(s) || (p.zip_code ?? "").includes(s);
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Properties</h1>
        <p className="text-sm text-gray-500">{properties.length} properties in warehouse</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search address, city, zip..."
          className="flex-1 min-w-[200px] max-w-sm rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm">
          <option value="all">All types</option>
          {types.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">Address</th>
                <th className="text-right px-4 py-2.5 font-medium">Beds</th>
                <th className="text-right px-4 py-2.5 font-medium">Baths</th>
                <th className="text-right px-4 py-2.5 font-medium">Sqft</th>
                <th className="text-left px-4 py-2.5 font-medium">Type</th>
                <th className="text-right px-4 py-2.5 font-medium">Year</th>
                <th className="text-left px-4 py-2.5 font-medium">Tools</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-gray-900 max-w-[250px] truncate">{p.address ?? "\u2014"}</p>
                    <p className="text-xs text-gray-500">{[p.city, p.state, p.zip_code].filter(Boolean).join(", ")}</p>
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-600">{p.beds ?? "\u2014"}</td>
                  <td className="px-4 py-2.5 text-right text-gray-600">{p.baths ?? "\u2014"}</td>
                  <td className="px-4 py-2.5 text-right text-gray-600">{p.sqft ? p.sqft.toLocaleString() : "\u2014"}</td>
                  <td className="px-4 py-2.5 text-gray-600 capitalize">{p.property_type ?? "\u2014"}</td>
                  <td className="px-4 py-2.5 text-right text-gray-600">{p.year_built ?? "\u2014"}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex gap-1">
                      <Link href={`/home-value-estimator?address=${encodeURIComponent(p.address ?? "")}`}
                        className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-[10px] font-medium text-gray-700 hover:bg-gray-50">
                        Estimate
                      </Link>
                      <Link href={`/smart-cma-builder?address=${encodeURIComponent(p.address ?? "")}`}
                        className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-[10px] font-medium text-gray-700 hover:bg-gray-50">
                        CMA
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
              {!filtered.length && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No properties found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
